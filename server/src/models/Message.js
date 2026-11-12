import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema(
  {
    sessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Session',
      required: true,
      index: true
    },
    content: {
      type: String,
      required: true
    },
    role: {
      type: String,
      enum: ['user', 'assistant', 'system'],
      required: true
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    attachments: {
      type: [String],
      default: []
    },
    isError: {
      type: Boolean,
      default: false
    }
  },
  {
    toJSON: {
      virtuals: true,
      transform: (doc, ret) => {
        ret.id = ret._id.toString();
        return ret;
      }
    }
  }
);

// Index for chronological retrieval per session
messageSchema.index({ sessionId: 1, timestamp: 1 });

export const Message = mongoose.model('Message', messageSchema);
export default Message;

