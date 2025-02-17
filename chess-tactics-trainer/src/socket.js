import { io } from "socket.io-client";

// Replace with your backend URL once deployed (or use localhost during development)
const SERVER_URL = "http://localhost:5000";
const socket = io(SERVER_URL);

export default socket;
