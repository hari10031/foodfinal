import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import connectDB from './config/db.js';
import cookieParser from 'cookie-parser';
import Authrouter from './routes/auth.route.js';
import cors from 'cors';
dotenv.config();
const app = express();
const port = process.env.PORT || 5000;
app.use(express.urlencoded({ extended: true }));
app.use(cors({
    origin: 'http://localhost:5173',
    credentials: true,
}))
app.use(express.json());
app.use(cookieParser());
app.use('/api/auth', Authrouter);



app.listen(port, () => {
    connectDB();
    console.log(`Server is running on port: ${port}`);
});