# TouchBase

TouchBase is a Progressive Web App that helps you maintain meaningful connections with your network. Stay in touch with friends, family, and colleagues through smart reminders and interaction tracking.

## Features

- 👥 Contact Management
  - Track personal and professional relationships
  - Set custom interaction frequencies
  - Record notes and preferences for each contact

- 🔔 Smart Reminders
  - Get notified when it's time to reach out
  - AI-powered suggestions for meaningful interactions
  - Customize reminder frequency per contact

- 📱 Multi-Platform
  - Progressive Web App (PWA) for desktop and mobile
  - Works offline
  - Cross-device synchronization

- 🎯 Relationship Insights
  - Track interaction history
  - Monitor relationship health
  - Get personalized suggestions for strengthening connections

- 🔒 Privacy & Security
  - End-to-end encryption
  - Google authentication
  - Self-hosted option available

## Tech Stack

- Frontend:
  - React with TypeScript
  - Tailwind CSS for styling
  - React Query for data fetching
  - Zustand for state management

- Backend:
  - Supabase for database and authentication
  - Groq API for AI suggestions
  - PayPal for payments

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Supabase account
- PayPal developer account
- Groq API key

### Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/touchbase.git
cd touchbase
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file:
```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_GROQ_API_KEY=your_groq_api_key
VITE_PAYPAL_CLIENT_ID=your_paypal_client_id
```

4. Start the development server:
```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser.

### Building for Production

```bash
npm run build
```

This will generate optimized production files in the `dist` directory.

## Contributing

1. Fork the repository
2. Create your feature branch: `git checkout -b feature/AmazingFeature`
3. Commit your changes: `git commit -m 'Add some AmazingFeature'`
4. Push to the branch: `git push origin feature/AmazingFeature`
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Icons from [Heroicons](https://heroicons.com)
- UI components inspired by [Tailwind UI](https://tailwindui.com)
