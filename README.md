
Built by https://www.blackbox.ai

---

```markdown
# URL Tracking Service

## Project Overview
This project implements a simple URL tracking service that allows users to create short tracking links. When a user clicks on a tracking link, the service redirects to the original URL while logging details such as the user's IP address and geographic location.

## Installation
To install this application, ensure you have [Node.js](https://nodejs.org/) and [npm](https://www.npmjs.com/) installed. Then, clone the repository and install the dependencies.

```bash
git clone https://github.com/yourusername/url-tracking-service.git
cd url-tracking-service
npm install
```

## Usage
To start the server, run the following command:

```bash
npm start
```

This will start the application on port 8000 (or a port specified in the environment variable `PORT`). You can access the service by navigating to `http://localhost:8000` in your web browser.

### API Endpoints
- **Create a new tracking link**:  
  **POST** `/api/create-link`  
  Request body:  
  ```json
  {
    "url": "https://example.com"
  }
  ```
  Example response:
  ```json
  {
      "trackingCode": "AbC123",
      "trackingUrl": "http://localhost:8000/t/AbC123",
      "destinationUrl": "https://example.com"
  }
  ```

- **Redirect to the original URL**:  
  **GET** `/t/:code`  
  Replace `:code` with the generated tracking code.

- **Link statistics**:  
  **GET** `/api/link-stats`  
  This retrieves an overview of all tracking links and their associated statistics.

- **Specific link details**:  
  **GET** `/api/link-stats/:code`  
  Replace `:code` with the tracking code to get detailed statistics for that link.

## Features
- Create short, trackable links.
- Redirect users to the original URL while logging click data.
- Retrieve statistics about clicks on each tracking link, including geographic location based on IP.

## Dependencies
This project is built on top of the following dependencies, as listed in `package.json`:

- **express**: A web framework for Node.js, used for building the server.
- **node-fetch**: A lightweight module that brings `window.fetch` to Node.js, used for making HTTP requests to fetch geolocation data.

## Project Structure
```
.
├── server.js                # Main server file
├── package.json             # Project metadata and dependencies
├── package-lock.json        # Exact versions of dependencies
└── public                   # Static files (like 404.html)
    └── 404.html             # Custom 404 error page
```

## Author
Your Name  
[Your Website or GitHub Profile](https://github.com/yourusername)

## License
This project is licensed under the ISC License. See the [LICENSE](LICENSE) file for details.
```

This README.md provides clear documentation for the URL Tracking Service, covering essential aspects that users and developers might need to understand and work with the project.