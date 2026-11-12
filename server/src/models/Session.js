import mongoose from 'mongoose';

const sessionSchema = new mongoose.Schema(
  {
    agentName: {
      type: String,
      default: 'Data analyst',
      trim: true
    },
    model: {
      type: String,
      default: 'mistral-large-latest',
      trim: true
    },
    createdAt: {
      type: Date,
      default: Date.now
    },
    environmentId: {
      type: String,
      default: null
    },
    datasetPath: {
      type: String,
      default: null
    },
    datasetSummary: {
      type: String,
      default: null
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

export const Session = mongoose.model('Session', sessionSchema);
export default Session;

