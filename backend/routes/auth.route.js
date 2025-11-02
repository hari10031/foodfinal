import { Router } from "express";
import { signIn, signOut, signup } from "../controllers/auth.controller.js";

const Authrouter = Router();

Authrouter.post('/signup', signup);
Authrouter.post('/signin', signIn);
Authrouter.post('/signout', signOut);

export default Authrouter;