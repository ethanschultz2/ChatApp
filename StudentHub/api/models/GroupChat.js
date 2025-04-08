const mongoose = require('mongoose');

const groupChatSchema = new mongoose.Schema({
  name: { type: String, required: true },         
  participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],  
  messages: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Message' }],   
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('GroupChat', groupChatSchema);
