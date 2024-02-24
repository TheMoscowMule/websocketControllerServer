const mongoose = require('mongoose');

const newDeviceSchema = new mongoose.Schema({
    uniqueid:String,
    os:String,
    name:String,
    online:Boolean,
    lastTime:Number,
    date:Number

});

const newDevice = mongoose.model('alltargets',newDeviceSchema);
module.exports = newDevice;
