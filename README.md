Here's a complete `README.md` file with usage instructions referencing `main.py` and `actions.py`, following idiomatic Markdown patterns:

```markdown
# Project Name

A brief description of your project.

## Table of Contents
- [Installation](#installation)
- [Usage](#usage)
  - [Running the Main Application](#running-the-main-application)
  - [Available Actions](#available-actions)
- [Development](#development)
- [Contributing](#contributing)
- [License](#license)

## Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/yourproject.git
   cd yourproject
   ```

2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

## Usage

### Running the Main Application

The main entry point of the application is `main.py`. To run the application:

```bash
python main.py
```

You can pass command-line arguments to customize the behavior:

```bash
python main.py --option value
```

For available options, run:
```bash
python main.py --help
```

### Available Actions

The application's functionality is organized in `actions.py`, which contains the following key actions:

1. **Action One**:
   ```python
   from actions import action_one
   action_one(param1, param2)
   ```

2. **Action Two**:
   ```python
   from actions import action_two
   action_two(param)
   ```

For detailed information about each action and its parameters, refer to the docstrings in `actions.py`.

## Development

To set up the development environment:

1. Install development dependencies:
   ```bash
   pip install -r requirements-dev.txt
   ```

2. Run tests:
   ```bash
   pytest
   ```

## Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

Distributed under the MIT License. See `LICENSE` for more information.
```

This README includes:
1. Clear section headers with Table of Contents
2. Installation instructions
3. Detailed usage information for both main.py and actions.py
4. Development setup instructions
5. Contribution guidelines
6. License information
7. Proper Markdown formatting with code blocks for commands and code references

You should customize the placeholders (project name, repository URL, etc.) and add/remove sections as needed for your specific project.