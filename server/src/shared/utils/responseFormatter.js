/**
 * 
 */

class ResponseFormatter {

    static success(data = null, message = "Success", statusCode = 200) {
        return {
            success: true,
            message,
            data,
            statusCode,
            timestamp: new Date().toISOString()
        }
    }

    static error(message = "Error", statusCode = 500, errors = null) {
        return {
            success: false,
            message,
            errors,
            statusCode,
            timestamp: new Date().toISOString()
        }
    }

    static validationError(Error = null) {
        return {
            success: false,
            message: "Validation Error",
            errors,
            statusCode: 400,
            timestamp: new Date().toISOString()
        }
    }

    static paginated(data = null, page, limit, total) {
        return {
            success: true,
            message: "Success",
            data,
            statusCode: 200,
            timestamp: new Date().toISOString(),
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
                hasNextPage: page < Math.ceil(total / limit),
                hasPreviousPage: page > 1,
            }
        }
    }
};

export default ResponseFormatter;