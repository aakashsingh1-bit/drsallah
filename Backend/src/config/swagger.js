const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Dr. Sallah Education Platform API',
      version: '1.0.0',
      description: `
## Dr. Sallah Education Platform

A full-featured education platform API with:
- 🔐 JWT-based authentication & device binding
- 🎓 Course / Module / Lesson management
- 💳 Subscription & access control
- 🛡️ Anti-piracy & security monitoring
- 📊 Admin analytics & reporting
      `,
      contact: {
        name: 'Dr. Sallah Platform',
        email: 'support@drsallah.com',
      },
    },
    servers: [
      { url: 'http://localhost:5000/api/v1', description: 'Development' },
      { url: `${process.env.API_URL}/api/v1`, description: 'Production' },
    ],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
    security: [{ BearerAuth: [] }],
  },
  apis: ['./src/routes/*.js'],
};

const specs = swaggerJsdoc(options);
module.exports = specs;