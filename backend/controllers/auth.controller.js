import User from "../models/users.model.js";
import bcrypt from "bcryptjs";
import genToken from "../utils/token.js";
export const signup = async (req, res) => {
    try {
        const [fullName, email, password, mobile, role] = req.body;
        let user = await User.findOne({ email });
        console.log("User lookup result:", user);
        if (user) {
            return res.status(400).json({ message: "User already exists" });
        }
        if (!fullName || !email || !password || !mobile || !role) {
            return res.status(400).json({ message: "All fields are required" });
        }
        if (password.length < 6) {
            return res.status(400).json({ message: "Password must be at least 6 characters" });
        }
        if (mobile.length !== 10) {
            return res.status(400).json({ message: "Mobile number must be 10 digits" });
        }
        console.log("All validations passed");
        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = new User({
            fullName, email, password: hashedPassword, mobile, role
        });
        await newUser.save();
        const token = await genToken(newUser._id);
        res.cookie("token", token, {
            secure: false,
            sameSite: "strict",
            maxAge: 7 * 24 * 60 * 60 * 1000,
            httpOnly: true
        });
        res.status(201).json({
            newUser
        });
    } catch (error) {
        return res.status(500).json({ message: "SignUp Error" });

    }
}
export const signIn = async (req, res) => {
    try {
        const [email, password] = req.body;
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ message: "User doesn't exists" });
        }
        if (!email || !password) {
            return res.status(400).json({ message: "All fields are required" });
        }

        const checkPass = await bcrypt.compare(password, user.password);
        if (!checkPass) {
            return res.status(400).json({ message: "Invalid Password" });
        }

        const token = await genToken(user._id);
        res.cookie("token", token, {
            secure: false,
            sameSite: "strict",
            maxAge: 7 * 24 * 60 * 60 * 1000,
            httpOnly: true
        });
        res.status(200).json({
            user
        });
    } catch (error) {
        return res.status(500).json({ message: "SignIn Error" });

    }
}
export const signOut = async (req, res) => {
    try {
        res.clearCookie("token");
        return res.status(200).json({ message: "SignOut Success" });
    } catch (error) {
        return res.status(500).json({ message: "SignOut Error" });
    }
}
