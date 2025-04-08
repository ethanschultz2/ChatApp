const mongoose = require('mongoose');

const classroomSchema = new mongoose.Schema({
    name: { type: String, required: true},
    courseId: { type: String, required: true},
    professor: {type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    users: [{type: mongoose.Schema.Types.ObjectId, ref: 'User'}],
    groupChats: [{type: mongoose.Schema.Types.ObjectId, ref: 'GroupChat'}],
});

module.exports = mongoose.model('Classroom', classroomSchema);