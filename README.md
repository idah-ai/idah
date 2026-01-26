<!-- 1. Project Title -->

# IDAH - Ingedata Annotation Hub

<!-- 2. Logo & Badges -->

<!-- LOGO GOES HERE -->

![GitHub stars](https://img.shields.io/github/stars/ingedata-ph/idah)
![License](https://img.shields.io/github/license/ingedata-ph/idah)
![Build Status](https://img.shields.io/github/actions/workflow/status/ingedata-ph/idah/ci.yml)

_A short description of the project._

---

<!-- 3. Table of Contents (TOC) -->

## Table of Contents

- [About](#about)
- [Features](#features)
- [Installation](#installation)
- [Usage](#usage)
- [Contributing](#contributing)
- [License](#license)

---

<!-- 4. About -->

## **About**

_Detailed explanation of the project, its purpose, and key highlights._

---

<!-- 5. Features -->

## **Features**

- _Feature 1_
- _Feature 2_
- _Feature 3_

---

<!-- TODO: TO BE REVIEWED -->
<!-- 6. Installation -->

## **Installation**

### Prerequisites

- _node_
- _pnpm (any node package manager; npm, pnpm, bun)_
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

By default, IDAH will start to run on the port `8443` by default.

IDAH webpage can be accessed at `https://idah.localhost:8443` or with the port configured.

---

<!-- TODO: TO BE REVIEWED -->
<!-- 7. Usage -->

## **Usage**

---

<!-- 8. Contributing -->

## **Contributing**

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

---

<!-- 9. License -->

## **License**

This project is licensed under the [MIT License](LICENSE).

---

<!-- 10. Additional Sections -->

## **Additional Sections (Optional)**

FAQ: Frequently asked questions.

Roadmap: Future plans.

Acknowledgments: Credits to contributors/libraries.

Example README.md

<!-- TODO: improvements as parts of docs-->
<!--
  1. setup method ? apart from docker
  2. setting up with/without databases
  3. revise setup/dev-setup script
  4. revise environment variables
  5. support external data sources/destinations (for medias, etc.)

-->
