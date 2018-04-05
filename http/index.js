module.exports = function (code, message) {
    message = message || null;

    if (message == null) {
        switch (code) {
            case 200:
                message = 'OK';
                break;
            case 400:
                message = 'Bad request';
                break;
            case 500:
                message = 'Server error';
                break;
            case 510:
                message = 'Not Extended';
                break;
        }
    }

    return {
        code,
        message
    }
}