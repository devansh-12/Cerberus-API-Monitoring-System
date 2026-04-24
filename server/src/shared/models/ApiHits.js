import mongoose from "mongoose";

/**
 *  MongoDB Schema for raw API hit events 
 * Stores every indivual API call
 */

const apiHitSchema = new mongoose.Schema({
    eventId: {
        type: String,
        required: true,
        unique: true,
        index: true,
    },
    timestamp: {
        type: Date,
        required: true,

    },
    serviceName: {
        type: String,
        required: true,
        index: true,
    },
    endpoint: {
        type: String,
        required: true,
        index: true,
    },
    method: {
        type: String,
        required: true,
        enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'],
    },
    statusCode: {
        type: Number,
        required: true,
        index: true,
    },
    latencyMs: {
        type: Number,
        required: true,
    },
    ClientId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Clients',
        required: true,
        index: true,
    },
    ApiKeyId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ApiKey',
        required: true,
        index: true,
    },
    ip: {
        type: String,
        required: true,
    },
    userAgent: {
        type: String,
    },
},

    {
        timestamps: true,
        collection: 'api_hits',
    }

);

//Indexes for performance
apiHitSchema.index({ timestamp: 1 }, { expireAfterSeconds: 2592000 });
apiHitSchema.index({ ClientId: 1, serviceName: 1, endpoint: 1, timestamp: -1 });
apiHitSchema.index({ ApiKeyId: 1, timestamp: -1 });
apiHitSchema.index({ clientId: 1, timestamp: -1, statuscode: 1 });

const ApiHit = mongoose.model('ApiHit', apiHitSchema);
export default ApiHit;