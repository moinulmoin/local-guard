# LocalGuard

Automatically manage Chrome extensions when developing on localhost. Disables extensions when visiting localhost to prevent interference with development and automatically restores them when leaving localhost.

## Features

- Automatically disables extensions when visiting localhost
- Remembers which extensions were enabled
- Automatically restores extensions when leaving localhost
- Manual control through popup interface
- Perfect for web development and testing

## Installation

1. (Install from Chrome Web Store)[https://chromewebstore.google.com/detail/localguard/ddankakpahmpdkihalnmgehjefnbjnkn]
2. Or build from source:
   ```bash
   # Clone the repository
   git clone https://github.com/moinulmoin/local-guard.git

   # Install dependencies
   pnpm install

   # Run the dev server
   pnpm dev

   # Get the extension dev build from `.output` folder

   # Load the extension in Chrome
   ```

## Usage

1. Visit any localhost URL (e.g., http://localhost:3000)
2. Extensions will be automatically disabled
3. Leave localhost to restore extensions
4. Use the popup for manual control

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
