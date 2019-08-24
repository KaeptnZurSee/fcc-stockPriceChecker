/*
*
*
*       Complete the API routing below
*
*
*/

'use strict';

var expect = require('chai').expect;
var MongoClient = require('mongodb');
const mongoose = require('mongoose');
const axios = require('axios');
let {Schema} = mongoose;
let stockSchema = new Schema({
  stockTicker: String,
  likes: {type:Number, default: 0},
  voted:[String]
})
let Stock = mongoose.model('Stocks',stockSchema);

const CONNECTION_STRING = process.env.DB; 

mongoose.connect(CONNECTION_STRING,(err,db)=>{
  if(err){
    console.log("could not connect to mongoDB");
  }
  else{
    console.log("connected successfully to mongoDB")
  }
})


module.exports = function (app) {
  
  let votes = 0;

  
  
  app.route('/api/stock-prices')
    .get(function (req, res){
      let ip = req.clientIp;
 
    if(!Array.isArray(req.query.stock)){
      //handle one stock requests 
      stockHandler(req.query.stock, req.query.like, ip);
      pushStockPrice(req.query.stock).then(data=>
    { 
        Stock.find({stockTicker: req.query.stock},(err,stock)=>{
        res.json({stockData:{stock:stock[0].stockTicker,likes:stock[0].likes, price:data.data["Global Quote"]['05. price']}})
      })     
      }).catch(err=>console.log(err));    

      
    }
    
    else{
      //handle multiple stock requests
      for(let i = 0;i<req.query.stock.length;i++){
        stockHandler(req.query.stock[i], req.query.like,ip);
      }
        pushStockPrice(req.query.stock[0]).then(stock1=>
    { 
        let price1=stock1.data["Global Quote"]['05. price'];
          pushStockPrice(req.query.stock[1]).then(stock2=>{
            
            let price2 = stock2.data["Global Quote"]['05. price'];
            
            Stock.find({stockTicker:req.query.stock[0]}).then( found=> {
              let res1 = found[0]
              Stock.find({stockTicker:req.query.stock[1]}).then(found2=> {
                let res2 = found2[0]
                res.json({stockData:[{stock:res1.stockTicker ,price:price1,relLikes:res1.likes-res2.likes},
                                     {stock:res2.stockTicker ,price:price2,relLikes:res2.likes-res1.likes}]})
                }).catch(err=>console.log(err))
              }
            )
            .catch(err=>console.log(err))
          }).catch(err=>console.log(err))
      
      }).catch(err=>console.log(err));   
      
 
    }
    });
  
  //helper functions
  
  //check ips to determine if the stock can be liked(again) or not
   function checkIp(ip,stockObj){
      for(let i in stockObj.voted){
        if(stockObj.voted[i]==ip){
          return true;
        }
      }
      return false;
    }
  
  //if the stock doesn't already exist create a new one with the request data
  function createAndSaveStock(name,liked,ip){
    let stockObj = new Stock({
      stockTicker: name,
      voted:liked?[ip]:[],
      likes:liked?1:0
    })

    stockObj.save((err,res)=>{
      if(err){
        res.send("something went wrong while saving the stock")
      }
      else{
        console.log("successfully saved the stock")
      }
    })
    return stockObj
  }
  
  //get the stockPrice and push it into the prices array
 async function pushStockPrice(name){
    let url = 'https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol='+name+'&apikey='+process.env.AV_API_KEY;
    return await axios.get(url)
 }
  
  function stockHandler(name,like,ip){
    Stock.find({stockTicker:name},(err,stocks)=>{
      if(stocks.length===0){
         createAndSaveStock(name,like,ip)
         }
      else{
        if(checkIp(ip,stocks[0])===false){
             stocks[0].likes +=like?1:0;
             stocks[0].voted.push(ip)
           }
      }
    })
  }
  
};
