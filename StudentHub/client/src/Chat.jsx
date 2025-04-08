import { useContext, useEffect, useState, useRef } from "react"
import Avatars from "./Avatars";
import Logo from "./Logo";
import { UserContext } from "./UserContext";
import uniqBy from 'lodash/uniqBy';
import axios from "axios";
import Contacts from "../Contacts";
import GroupChat from "../GroupChat";

export default function Chat(){
    const [ws, setWs] = useState(null);
    const [onlinePeople, setOnlinePeople] = useState({});
    const [offlinePeople, setOfflinePeople] = useState({});
    const [selectedUserId, setselectedUserId] = useState(null)
    const [newMessageText, setNewMessageText] = useState('');
    const {username, id, setId, setUsername} = useContext(UserContext);
    const [messages, setMessages] = useState([]);
    const divUnderMessages = useRef(null);
    const [selectedGroupChatId, setSelectedGroupChatId] = useState(null);
    const [groupChats, setGroupChats] = useState([]);
    const [newGroupName, setNewGroupName] = useState('');
    const [groupMembers, setGroupMembers] = useState([]);   

    useEffect(() => {
        connectToWs();
        fetchGroupChats();
    }, []);

    function connectToWs(){
        const ws = new WebSocket('ws://localhost:4000');
        setWs(ws);
        ws.addEventListener('message', handleMessage);
        ws.addEventListener('close', () => {
            setTimeout(() => {
                connectToWs();
            }, 1000);
        });
    }

    function fetchGroupChats(){
        axios.get('/groupChats')
        .then((res) => {
            if(Array.isArray(res.data)){
            setGroupChats(res.data);
            }else {
                console.error("Received invalid data format for group chats:", res.data);
                setGroupChats([]); // fallback to empty array if data is invalid
            }
        })
        .catch((error) => {
            console.error("Error fetching group chats:", error);
        });
    }
    function showOnlinePeople(peopleArray){
        const people = {};
        peopleArray.forEach(({userId,username}) => {
            people[userId] = username;
        });
        setOnlinePeople(people);
    }

    function handleMessage(ev){
        const messageData = JSON.parse(ev.data);
        if('online' in messageData){
            showOnlinePeople(messageData.online);
        }else if ('text' in messageData){
            if(messageData.groupChatId == selectedUserId || messageData.sender === selectedUserId){
            setMessages(prev => ([...prev, {...messageData}]));
            }
        }
    }

    function handleGroupChatClick(groupChatId) {
        setSelectedGroupChatId(groupChatId);

        if(groupChatId){
            //gets group chat messages when selected
            axios.get(`/groupChats/${groupChatId}/messages`).then((res) => {
                setMessages(res.data);
            });
            // Fetch group members when selected
            axios.get(`/groupChats/${groupChatId}/members`).then((res) => {
                setGroupMembers(res.data);
        });
        } else {
            console.log("Group chat ID is invalid");
        }
    };

    function handleGroupChatCreate(ev) {
        ev.preventDefault();
        const groupData = {
            name: newGroupName,
            members: groupMembers,
        };

        axios.post('/groupChats/create', groupData)
        .then((response) => {
            setGroupChats((prevGroupChats) => [...prevGroupChats, response.data]);
            setNewGroupName('');
            setGroupMembers([]);
        })
        .catch((error) => {
            console.error("Error creating group chat:", error);
        });
    }

    function logout(){
        axios.post('logout').then(() => {
            setWs(null);
            setId(null);
            setUsername(null);
        });
    }

    function sendMessage(ev, file = null){
        if(ev){
            ev.preventDefault();
        }
        //getting message data
        const messageData = {
            recipient: selectedGroupChatId ? null : selectedUserId,
            groupChatId: selectedGroupChatId,
            text: newMessageText,
            file,
        };

        ws.send(JSON.stringify(messageData));

        setNewMessageText(''); //after sending delete text 

        setMessages(prev => ([... prev, {
            text: newMessageText, 
            _id: Date.now(),
            sender: id,
            recipient: selectedUserId,
            groupChatId: messageData.groupChatId,
        }]));

        if(file) {
            axios.get('/messages/'+selectedUserId).then(res => {
                setMessages(res.data);
            });
        }
    }

    function sendFile(ev){
        const reader = new FileReader();
        reader.readAsDataURL(ev.target.files[0]);
        reader.onload = () => {
            sendMessage(null, {
                name: ev.target.files[0].name,
                data: reader.result,
            });
        };
    }

    useEffect(() => {
        const div = divUnderMessages.current;
        if(div){
            div.scrollIntoView({behavior: 'smooth', block: 'end'});
        }
    }, [messages]);

    useEffect(() => {
        axios.get('/people').then(res => {
            const offlinePeopleArray = res.data
            .filter(p => p._id !== id)
            .filter(p => !Object.keys(onlinePeople).includes(p._id));
            const offlinePeople = {};
            offlinePeopleArray.forEach(p => {
                offlinePeople[p._id] = p;
            });
            setOfflinePeople(offlinePeople);
        });
    }, [onlinePeople]);

    useEffect(() => {
        if(selectedUserId){//if you click on user show previous messages from database
            axios.get('/messages/'+selectedUserId).then(res => {
                setMessages(res.data);
            });
        } else if(selectedGroupChatId){
            // If it's a group chat, fetch messages for the group chat
            axios.get('/messages/group/' + selectedGroupChatId).then(res => {
            setMessages(res.data);
        });
        }
    }, [selectedUserId], selectedGroupChatId);

    const excludeOurUser = {...onlinePeople};
    delete excludeOurUser[id];

    const messageWithoutDupes = uniqBy(messages, '_id');


    return(
        <div className="flex h-screen">
            <div className="bg-white-100 w-1/3 flex flex-col">
                <div className="flex-grow">
                    <Logo />
                    {Object.keys(excludeOurUser).map(userId => (
                        <Contacts 
                        key={userId}
                        id={userId} 
                        online={true}
                        username={excludeOurUser[userId]}
                        onClick={() => setselectedUserId(userId)}
                        selected={userId == selectedUserId} />
                    ))}
                    {Object.keys(offlinePeople).map(userId => (
                        <Contacts 
                        key={userId}
                        id={userId} 
                        online={false}
                        username={offlinePeople[userId].username}
                        onClick={() => setselectedUserId(userId)}
                        selected={userId == selectedUserId} />
                    ))}
                <div className="group-chats">
                    {groupChats.map((group) => (
                        <GroupChat
                            key={group._id}
                            group={group}  // Pass the entire group object
                            onClick={handleGroupChatClick}
                            online={true}
                            selected={group._id === selectedGroupChatId}  // Check if the group is selected
                        />
                    ))}
                </div>
                </div>
                <div className="p-4 border-t border-t-blue-500 rounded">
                    <h3 className="text-xl">Create a Group Chat</h3>
                    <form onSubmit={handleGroupChatCreate} className="flex flex-col space-y-2">
                    <input 
                    type="text"
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    className="border p-2 rounded"
                    placeholder="Group name"
                    required
                    />
                    <select
                        multiple
                        className="border p-2 rounded"
                        value={groupMembers}
                        onChange={(e) => setGroupMembers(Array.from(e.target.selectedOptions, option => option.value))}
                    >
                        {Object.keys(onlinePeople).map((userId) => (
                            <option key={userId} value={userId}>
                                {onlinePeople[userId]}
                            </option>
                        ))}
                    </select>
                    <button type="submit" className="bg-blue-500 text-white p-2 rounded-md">Create Group Chat</button>
                    </form>
                </div>

                <div className="p-2 text-center items-center justify-center">
                  <span className="mr-2 text-sm text-gray-500 flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="size-6">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M17.982 18.725A7.488 7.488 0 0 0 12 15.75a7.488 7.488 0 0 0-5.982 2.975m11.963 0a9 9 0 1 0-11.963 0m11.963 0A8.966 8.966 0 0 1 12 21a8.966 8.966 0 0 1-5.982-2.275M15 9.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                    </svg>
                    {username}
                  </span> 
                  <button 
                    onClick={logout}
                    className="text-sm bg-blue-100 py-1 px-2 text-grey-500 border rounded-md">logout</button>
                </div>
            </div>
            <div className="flex flex-col bg-blue-50 w-2/3 p-2">
                <div className="flex-grow">
                    {!selectedUserId && selectedGroupChatId && (
                        <div className="flex h-full items-center justify-center">
                            <div className="text-gray-300">&larr; Select a person</div>
                        </div>
                    )}
                    {(!!selectedUserId || selectedGroupChatId) && (
                        <div className="relative h-full">
                            <div className="overflow-y-scroll absolute top-0 left-0 right-0 bottom-2">
                                {messageWithoutDupes.map(message => (
                                    <div key={message._id} className={`${message.sender === id ? 'text-right' : 'text-left'}`}>
                                        <div className={`inline-block p-2 my-2 rounded-md text-sm ${message.sender === id ? 'bg-blue-500 text-white' : 'bg-white text-gray-500'}`}>
                                            {message.text}
                                            {message.file && (
                                                <div>
                                                    <a target="_blank" className="flex items-center gap-1 border-b " href={axios.defaults.baseURL + '/uploads/' + message.file}>
                                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="size-6">
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="m18.375 12.739-7.693 7.693a4.5 4.5 0 0 1-6.364-6.364l10.94-10.94A3 3 0 1 1 19.5 7.372L8.552 18.32m.009-.01-.01.01m5.699-9.941-7.81 7.81a1.5 1.5 0 0 0 2.112 2.13" />
                                                    </svg>
                                                    {message.file}
                                                    </a>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                                <div ref={divUnderMessages}></div>
                            </div>
                        </div>
                    )}
                </div>
                {(!!selectedUserId || selectedGroupChatId) && (
                    <form className="flex gap-2" onSubmit={sendMessage}>
                    <input type="text" 
                    value={newMessageText}
                    onChange={ev => setNewMessageText(ev.target.value)}
                    className="bg-white border p-2 rounded sm p-2" 
                    placeholder="Type your message here"/>
                    <label className="bg-gray-200 cursor-pointer p-2 text-gray-600 rounded sm p-2">
                        <input type="file" className="hidden" onChange={sendFile}/>
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="size-6">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m18.375 12.739-7.693 7.693a4.5 4.5 0 0 1-6.364-6.364l10.94-10.94A3 3 0 1 1 19.5 7.372L8.552 18.32m.009-.01-.01.01m5.699-9.941-7.81 7.81a1.5 1.5 0 0 0 2.112 2.13" />
                    </svg>
                    </label>
                    <button type="submit" className="bg-blue-500 p-2 text-white rounded sm p-2">
                        Send
                    </button>
                </form>
                )}
            </div>
        </div>
    );
}