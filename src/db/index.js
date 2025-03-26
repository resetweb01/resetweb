import mongoose from "mongoose";
import AccessCode from "../models/accessCode.models.js";

const connectDB = async () => {
  try {
    const connectionInstance = await mongoose.connect(process.env.MONGODB_URI);

    // Create TTL index if missing
    await AccessCode.collection.createIndex(
      { expiresAt: 1 },
      { expireAfterSeconds: 0 } // Auto-delete when expired
    );
    // console.log("TTL index verified");
    // console.log(
    //   `\n MONGODB connected !! DB HOST: ${connectionInstance.connection.host}`
    // );
  } catch (error) {
    console.error("MONGODB CONNECTION FAILED: ", error);
    process.exit(1);
  }
};

export default connectDB;