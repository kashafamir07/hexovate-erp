import mongoose from "mongoose";

const { Schema } = mongoose;

const messageSchema = new Schema(
  {
    // DM vs channel: channelName set => broadcast message in that channel.
    channelName: { type: String, default: "" },
    sender: { type: Schema.Types.ObjectId, ref: "User", required: true },
    recipients: [{ type: Schema.Types.ObjectId, ref: "User" }],
    subject: { type: String, default: "" },
    body: { type: String, required: true },
    readBy: [{ type: Schema.Types.ObjectId, ref: "User" }],
    attachments: [{ name: String, url: String, size: Number }],
  },
  { timestamps: true }
);

messageSchema.index({ channelName: 1, createdAt: 1 });
messageSchema.index({ recipients: 1, createdAt: 1 });

export const Message = mongoose.model("Message", messageSchema);
