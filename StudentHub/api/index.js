const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('./models/User');
const jwt = require('jsonwebtoken');
const cors = require ('cors');
const bcrypt = require('bcryptjs');
const cookieParser = require('cookie-parser');
const ws = require('ws');
const Message = require('./models/Message');
const GroupChat = require('./models/GroupChat');
const fs = require('fs');
const router = express.Router();

dotenv.config();
mongoose.connect(process.env.MONGO_URL);
const jwtSecret = process.env.JWT_SECRET;
const bcryptSalt = bcrypt.genSaltSync(10);

const app = express();
app.use('/uploads', express.static(__dirname + '/uploads'));
app.use(express.json());
app.use(cookieParser());
app.use(cors({
    credentials: true,
    origin: process.env.CLIENT_URL,
}));

async function getUserData(req){
    return new Promise((resolve, reject) => {
    const token = req.cookies?.token;
    if(token){
        jwt.verify(token, jwtSecret, {}, (err, userData) => {
        if(err) throw err;
        resolve(userData);
        });
    }else{
        reject('no token');
    }
    });
}

app.get('/test', (req, res) => {
    res.json('test ok');
});

app.get('/messages/:userId', async (req, res) => {
    const {userId} = req.params;
    const userData = await getUserData(req);
    const ourUserId = userData.userId;
    const messages = await Message.find({
        sender:{ $in: [userId, ourUserId]},
        recipient: {$in: [userId, ourUserId]},
    }).sort({ createdAt: 1 });
    res.json(messages);
});

app.get('/messages/group/:groupChatId', async (req, res) => {
    const { groupChatId } = req.params;
    const userData = await getUserData(req); // Get the current user's data

    try {
        // Fetch messages for the group chat
        const messages = await Message.find({
            groupChat: groupChatId,
        }).sort({ createdAt: 1 }); // Sorting messages by creation date
        
        res.json(messages);
    } catch (err) {
        res.status(500).json({ message: 'Error fetching group chat messages', error: err });
    }
});


app.get('/people', async (req, res) =>{
   const users = await User.find({}, {'_id': 1, username: 1});
   res.json(users);
});

app.get('/profile', (req, res) => {
    const token = req.cookies?.token;
    if(token){
        jwt.verify(token, jwtSecret, {}, (err, userData) => {
        if(err) throw err;
        res.json(userData);
        });
    } else{
        res.status(401).json('no tokens');
    }
});

app.get('/groupChats', async (req,res) => {
    try {
        const groupChats = await GroupChat.find().populate('participants', 'username');;
        res.json(groupChats);
    } catch (err) {
        res.status(500).json({ message: 'Error fetching group chats server side', error: err});
    }
});

app.post('/login', async (req, res) => {
    const {username, password} = req.body;
    const foundUser = await User.findOne({username});
    if (foundUser){
        const verified = bcrypt.compareSync(password, foundUser.password);
        if(verified){
            jwt.sign({userId: foundUser._id, username}, jwtSecret, {}, (err,token) => {
                res.cookie('token', token, {sameSite:'none', secure:true}).json({
                    id: foundUser._id,
                });
            });
        }
    }
});

app.post('/groupChats/create', async (req, res) => {
    const { name, participants } = req.body; //participants is an array of user ids

    try{ 
        const groupChat = new GroupChat({
            name, 
            participants,
        });

        await groupChat.save();
        res.status(201).json(groupChat);
    }catch (err){
        res.status(500).json({ message: 'Error creating a groupchat', errpr: err});
    }
});

app.post('/logout', (req, res) => {
    res.cookie('token', '', {sameSite:'none', secure:true});
    res.json('Okay');
});

app.post('/register', async (req, res) => {
    const {username, password} = req.body;
    try{
        const hashedPassword = bcrypt.hashSync(password, bcryptSalt);
        const createdUser = await User.create({
        username:username, 
        password:hashedPassword,
    });
        jwt.sign({userId: createdUser._id, username}, jwtSecret, {}, (err, token) => {
            if(err) throw err;
            res.cookie('token', token, {sameSite:'none', secure:true}).status(201).json({
            id: createdUser._id,
            });
        });
    } catch(err){
        console.log(err);
        res.status(500).json('error');
    }
});

const server = app.listen(4000);

//creating websocket server
const wss = new ws.WebSocketServer({server});

wss.on('connection', (connection, req) => {

    function notifyOnlinePeople(){
        [...wss.clients].forEach(client => {
            client.send(JSON.stringify({
                online: [...wss.clients].map(c => ({userId:c.userId, username:c.username})),
            }));
        });
    }

    connection.isAlive = true;

    connection.timer = setInterval(() => {
        connection.ping();
        connection.deathTimer = setTimeout(() =>{
            connection.isAlive = false;
            clearInterval(connection.timer);
            connection.terminate();
            notifyOnlinePeople();
        }, 1000);
    }, 5000);


    connection.on('pong', () => {
        clearTimeout(connection.deathTimer);
    });

    //reading user name and ID from cookie
    const cookies = req.headers.cookie;
    if(cookies){
        const tokenCookie = cookies.split(';').find(str => str.startsWith('token='));
        if(tokenCookie){
            const token = tokenCookie.split('=')[1];
            if(token){
                jwt.verify(token, jwtSecret, {}, (err, userData) => {
                    if(err) throw err;
                    const {userId, username} = userData;
                    connection.userId = userId;
                    connection.username = username;
                });
            }
        }
    }

    connection.on('message', async (message) => {
        const messageData = JSON.parse(message.toString());
        const {recipient, text, file, groupChatId} = messageData;
        let filename = null;

        if(file){
            const parts = file.name.split('.');
            const extension = parts[parts.length-1];
            filename = Date.now() + '.' + extension;
            const path = __dirname + '/uploads/' + filename;
            const bufferdata = new Buffer(file.data.split(',')[1], 'base64');
            fs.writeFile(path, bufferdata, () => {
                console.log('File Saved');
            });
        }
        //Handles private messges
        if (recipient && (text || file)) {
            //save message to database
            const messageDoc = await Message.create({
                sender: connection.userId,
                recipient,
                text,
                file: file ? filename : null, 
                groupChat: null,
            });

            [...wss.clients]
            .filter(c => c.userId === recipient)
            .forEach(c => c.send(JSON.stringify({
                text, 
                sender: connection.userId,
                recipient,
                file: file ? filename: null,
                _id:messageDoc._id,
            })));
        }

        //Handles group chat messages
        if (groupChatId && (text || file)) {

            const messageDoc = await Message.create({
                sender: connection.userId,
                recipient: null,
                text,
                file: file ? filename: null,
                groupChat: groupChatId,
            });

            const groupChat = await GroupChat.findById(groupChatId);

            if (groupChat) {
                groupChat.participants.forEach(participantId => {
                [...wss.clients]
                    .filter(c => c.userId === participantId)
                    .forEach(c => c.send(JSON.stringify({
                        text, 
                        sender: connection.userId,
                        groupChatId,
                        file: file ? filename: null,
                        _id: messageDoc._id,
                    })));
                });
            }
        }
    });

    //notifying about whos online 
    notifyOnlinePeople();
});

