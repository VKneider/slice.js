# Contributing to Slice.js

First off, thank you for considering contributing to Slice.js! It's people like you that make Slice.js such a great tool.

Following these guidelines helps to communicate that you respect the time of the developers managing and developing this open source project. In return, they should reciprocate that respect in addressing your issue, assessing changes, and helping you finalize your pull requests.

## Code of Conduct

This project and everyone participating in it is governed by the [Slice.js Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code. 

## How Can I Contribute?

### Reporting Bugs

This section guides you through submitting a bug report for Slice.js. Following these guidelines helps maintainers and the community understand your report, reproduce the behavior, and find related reports.

**Before Submitting A Bug Report:**

* Check the documentation and see if the behavior you're experiencing is covered there.
* Check if the bug has already been reported in the [issues section](https://github.com/VKneider/slice.js/issues).
* Make sure to use the latest version of Slice.js.

**How Do I Submit A Bug Report?**

Bugs are tracked as [GitHub issues](https://github.com/VKneider/slice.js/issues). Create an issue and provide the following information:

* Use a clear and descriptive title for the issue.
* Describe the exact steps which reproduce the problem.
* Describe the behavior you observed after following the steps.
* Explain which behavior you expected to see instead and why.
* Include screenshots or animated GIFs if possible.
* Include details about your environment (browser, OS, etc).

### Suggesting Enhancements

This section guides you through submitting an enhancement suggestion for Slice.js, including completely new features and minor improvements to existing functionality.

**Before Submitting An Enhancement Suggestion:**

* Check if the enhancement has already been suggested or implemented.
* Briefly search the issues to ensure it hasn't been suggested before.

**How Do I Submit An Enhancement Suggestion?**

Enhancement suggestions are tracked as [GitHub issues](https://github.com/VKneider/slice.js/issues). Create an issue and provide the following information:

* Use a clear and descriptive title for the issue.
* Provide a detailed description of the suggested enhancement.
* Explain why this enhancement would be useful to most Slice.js users.
* Include mockup designs or examples if applicable.

### Your First Code Contribution

Unsure where to begin contributing to Slice.js? You can start by looking through the "beginner-friendly" and "help-wanted" issues:

* [Beginner issues](https://github.com/VKneider/slice.js/labels/beginner) - issues which should only require a few lines of code.
* [Help wanted issues](https://github.com/VKneider/slice.js/labels/help%20wanted) - issues which should be a bit more involved than beginner issues.

### Pull Requests

The process described here has several goals:

* Maintain Slice.js's quality
* Fix problems that are important to users
* Engage the community in working toward the best possible Slice.js
* Enable a sustainable system for Slice.js's maintainers to review contributions

Please follow these steps to have your contribution considered by the maintainers:

1. Follow all instructions in the template when creating a pull request
2. Follow the coding style (Prettier formatting)
3. After you submit your pull request, verify that all status checks are passing

## Development Setup

### Prerequisites

* Node.js (version 20.x)
* npm

### Setting Up Development Environment

1. Fork the repository on GitHub
2. Clone your fork locally:
   ```
   git clone https://github.com/YOUR-USERNAME/slice.js.git
   cd slice.js
   ```
3. Install dependencies:
   ```
   npm install
   ```
4. Create a branch for your feature or bugfix:
   ```
   git checkout -b my-new-feature
   ```

### Development Workflow

1. Make your changes in the code.
2. Run the formatting tool (Prettier):
   ```
   npm run format
   ```
3. Test your changes locally:
   ```
   npm run slice:start
   ```
4. Commit your changes:
   ```
   git commit -m "Description of your changes"
   ```
5. Push your branch to GitHub:
   ```
   git push origin my-new-feature
   ```
6. Create a pull request from your branch

## Coding Style Guidelines

Slice.js follows the following coding standards:

1. We use Prettier for code formatting with the following configuration (from package.json):
   ```json
   "prettier": {
     "trailingComma": "es5",
     "tabWidth": 3,
     "semi": true,
     "singleQuote": true,
     "printWidth": 120
   }
   ```

2. Use meaningful variable and function names.
3. Write comments for complex logic or non-obvious functionality.
4. Follow component structure conventions:
   - Each component should have separate `.js`, `.html`, and `.css` files
   - Follow the established pattern for component organization
   - CSS should be scoped to the component to avoid style conflicts

## Creating New Components

When creating new components, follow these guidelines:

1. Use the component creation command:
   ```
   npm run slice:create
   ```
2. Follow the naming conventions in the existing codebase
3. Properly separate logic (JS), structure (HTML), and styling (CSS)
4. Components should be self-contained and reusable
5. Document your component's functionality, properties, and usage

## Testing

Currently, we're developing our testing strategy. For now, manually test your components and changes to ensure they work as expected in different browsers and scenarios.

## Documentation

Documentation is a critical part of Slice.js. When adding new features or changing existing ones, make sure to:

1. Update relevant documentation
2. Include example usage where appropriate
3. Document API changes

## Styleguides

### Git Commit Messages

* Use the present tense ("Add feature" not "Added feature")
* Use the imperative mood ("Move cursor to..." not "Moves cursor to...")
* Limit the first line to 72 characters or less
* Reference issues and pull requests liberally after the first line

## Questions?

If you have any questions, please feel free to reach out to the Slice.js team.

Thank you for contributing to Slice.js!