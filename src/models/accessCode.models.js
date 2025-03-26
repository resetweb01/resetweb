import mongoose from "mongoose";

const AccessCodeSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    expiryDays: {
      type: Number,
      required: true,
      min: 1,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: 0 }, // TTL index (auto-delete expired docs)
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    isUsed: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Auto-set expiresAt before saving
AccessCodeSchema.pre("save", function (next) {
  if (!this.expiresAt && this.expiryDays) {
    // Auto-set expiresAt if not provided
    this.expiresAt = new Date(Date.now() + this.expiryDays * 86400000);
  }
  next();
});

export default mongoose.model("AccessCode", AccessCodeSchema);