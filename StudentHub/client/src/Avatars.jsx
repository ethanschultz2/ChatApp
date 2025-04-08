export default function Avatars({username, userId, online}){
    const colors = ['bg-red-200','bg-green-200', 'bg-purple-200', 
        'bg-pink-200', 'bg-blue-200', 'bg-yellow-200', 'bg-teal-200'];
    const userIdDec = parseInt(userId, 16);
    const colorIdx = userIdDec % colors.length;
    const color = colors[colorIdx];
    return (
        <div className={`w-8 h-8 relative rounded-full items-center ${color}`}>
            <div className="text-center w-full opacity-70">{username[0]}</div>
            {online && (
                <div className="absolute w-3 h-3 bg-green-400 bottom-0 right-0 rounded-full border border-white"></div>
            )}
            {!online && (
                <div className="absolute w-3 h-3 bg-gray-400 bottom-0 right-0 rounded-full border border-white"></div>
            )}
        </div>
    );
}