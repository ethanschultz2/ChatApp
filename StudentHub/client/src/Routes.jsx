
import Chat from "./Chat";
import RegisterAndLogin from "./RegisterAndLogin";
import Register from "./RegisterAndLogin";
import { UserContext } from "./UserContext";
import { useContext } from "react";

export default function Routes(){
    const {username, id} = useContext(UserContext);

    if(username){
        return <Chat/>
    }
    return(
        <RegisterAndLogin/>
    );
}