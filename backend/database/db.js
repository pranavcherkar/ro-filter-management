import mongoose from "mongoose";
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    // await mongoose.connect(`mongodb://localhost:27017/Users`);
    console.log("Mongodb Data connnected");
  } catch (error) {
    console.log("MongoDB connection error", error);
  }
};
export default connectDB;
