import React, { useEffect, useState } from 'react';
import Avatars from './src/Avatars';

export default function GroupChat({ group, onClick, selected, groupMembers = [], online }) {
    const colors = [
        'bg-red-500', 'bg-blue-500', 'bg-green-500', 'bg-yellow-500',
        'bg-purple-500', 'bg-pink-500', 'bg-indigo-500', 'bg-teal-500'
    ];
    const color = colors[group.name.length % colors.length];

    return (
        <div
            key={group._id}
            onClick={() => onClick(group._id)}
            className={`border-b border-gray-100 flex items-center gap-2 cursor-pointer`}
        >
            {selected && <div className="w-1 bg-blue-500 h-12 rounded-r-md"></div>}

            <div className="flex gap-2 py-2 pl-4 items-center">
                <div className={`w-8 h-8 relative rounded-full flex items-center justify-center ${color}`}>
                    <div className="text-center text-black opacity-70">{group.name[0]}</div>
                </div>

                <div className="flex gap-2">
                    {groupMembers.map((member) => (
                        <Avatars
                            key={member._id}
                            username={member.username}
                            userId={member._id}
                            online={member.online}  // Assuming 'online' field is available
                        />
                    ))}
                </div>
            </div>

            {selected && (
                <div className="members-list pl-4 pt-2 pb-4">
                    <h4 className="font-semibold">Members:</h4>
                    <ul className="list-disc pl-6">
                        {groupMembers.map((member) => (
                            <li key={member._id}>
                                <span>{member.username}</span>
                                {member.online ? (
                                    <span className="text-green-500">(Online)</span>
                                ) : (
                                    <span className="text-red-500">(Offline)</span>
                                )}
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
}
