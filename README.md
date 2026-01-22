<!-- 1. Project Title -->

# IDAH - Ingedata Annotation Hub

<!-- 2. Logo & Badges -->

<!-- LOGO GOES HERE -->

![GitHub stars](https://img.shields.io/github/stars/ingedata-ph/idah)
![License](https://img.shields.io/github/license/ingedata-ph/idah)
![Build Status](https://img.shields.io/github/actions/workflow/status/ingedata-ph/idah/ci.yml)

_A short description of the project._

<!-- 3. Table of Contents (TOC) -->

## Table of Contents

- [About](#about)
- [Features](#features)
- [Installation](#installation)
- [Usage](#usage)
- [Contributing](#contributing)
- [License](#license)

<!-- 4. About -->

## About

_Detailed explanation of the project, its purpose, and key highlights._

<!-- 5. Features -->

## Features

- _Feature 1_
- _Feature 2_
- _Feature 3_

<!-- TODO: TO BE REVIEWED -->
<!-- 6. Installation -->

## Installation

### Prerequisites

- _node_
- _pnpm (node package manager; npm, pnpm, bun)_
- _Ruby (version ...)_

### Clone the repo

```bash
git clone https://github.com/ingedata-ph/idah.git
cd idah
```

<!-- TODO: need to move database containers into idah -->

### Starting with Docker containers

```bash
docker compose up -d
```

<!-- TODO: run setup  script in dockerfile ? -->

By default, IDAH will start to run on the port `8443`

You can access the webpage at `https://idah.localhost:8443`

<!-- TODO: TO BE REVIEWED -->
<!-- 7. Usage -->

## **7. Usage**

<!-- 8. Contributing -->

## **8. Contributing**

1. Fork the repository.
2. Create a feature branch (`git checkout -b feature/foo`).
3. Commit changes (`git commit -am "Add foo"`).
4. Push to the branch (`git push origin feature/foo`).
5. Open a Pull Request.

### Project Structure

```text
/
├── app/
│   └── microservice_app_name/
│       ├── app/
│       │   ├── expo/
│       │   │   └── app_expo.rb       # Exposition Layer (API, Resource Events)
│       │   ├── model/
│       │   │   └── app_model.rb      # Model Layer (Record, Repository)
│       │   └── service/
│       │       └── app_service.rb    # Service Layer
│       ├── config/
│       ├── db/
│       │   └── migrations/           # Database Migrations
│       ├── .env
│       ├── Dockerfile
│       └── Gemfile
├── common/
└── plugins/
    ├── idah-video
    └── other-plugins
```

<!-- 9. License -->

## **9. License**

This project is licensed under the [MIT License](LICENSE).

<!-- 10. Additional Sections -->

## 10. Additional Sections (Optional)

FAQ: Frequently asked questions.

Roadmap: Future plans.

Acknowledgments: Credits to contributors/libraries.

Example README.md
