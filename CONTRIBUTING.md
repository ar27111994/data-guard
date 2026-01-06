# Contributing to DataGuard

Thank you for your interest in contributing to DataGuard! This document provides
guidelines and steps for contributing.

## Getting Started

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/YOUR-USERNAME/data-guard.git
   cd data-guard
   ```
3. **Install dependencies**:
   ```bash
   npm install
   ```
4. **Run tests** to ensure everything works:
   ```bash
   npm test
   ```

## Development Workflow

1. Create a new branch for your feature/fix:

   ```bash
   git checkout -b feature/your-feature-name
   ```

2. Make your changes and ensure:

   - All tests pass (`npm test`)
   - Code follows existing style conventions
   - New features include tests

3. Commit your changes:

   ```bash
   git commit -m "feat: Add your feature description"
   ```

4. Push to your fork and submit a Pull Request

## Commit Message Convention

We use [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` - New features
- `fix:` - Bug fixes
- `docs:` - Documentation changes
- `test:` - Adding or updating tests
- `refactor:` - Code refactoring
- `chore:` - Maintenance tasks

## Pull Request Guidelines

- Fill out the PR template completely
- Link any related issues
- Include tests for new functionality
- Update documentation as needed
- Ensure CI checks pass

## Reporting Issues

- Use the issue templates provided
- Include reproduction steps
- Provide sample data if applicable (anonymized)
- Specify your environment (Node.js version, OS)

## Code Style

- Use ES6+ features
- Follow existing code patterns
- Add JSDoc comments for public functions
- Keep functions focused and small

## Questions?

Feel free to open an issue for any questions or concerns.
