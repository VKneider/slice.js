export default class Log {
    constructor(logType, componentCategory, componentSliceId, message, error = null) {
        this.logType = logType;
        this.componentCategory = componentCategory;
        this.componentSliceId = componentSliceId;
        this.message = message;
        this.error = error;
        this.timestamp = new Date();
    }
}
