/**
 * Google OAuth2 Configuration
 * Family Dashboard Calendar Integration
 */

export const GOOGLE_OAUTH_CONFIG = {
    // Get these from Google Cloud Console: https://console.cloud.google.com/apis/credentials
    clientId: 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com',
    clientSecret: 'YOUR_GOOGLE_CLIENT_SECRET',
    scopes: [
        'https://www.googleapis.com/auth/calendar',
        'https://www.googleapis.com/auth/calendar.events'
    ],
    // Must be HTTPS - use Nabu Casa or your own domain (Google rejects private IPs)
    redirectUri: 'https://your-instance.ui.nabu.casa/local/dashboard/oauth-callback.html',
    authEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenEndpoint: 'https://oauth2.googleapis.com/token'
};

// Family members with their colors (customize for your family)
export const FAMILY_MEMBERS = {
    person1: {
        name: 'Person 1',
        color: '#ec4899',
        colorId: '4', // Google Calendar color ID (flamingo/pink)
        bgClass: 'bg-pink-500',
        textClass: 'text-pink-400',
        borderClass: 'border-pink-500'
    },
    person2: {
        name: 'Person 2',
        color: '#3b82f6',
        colorId: '9', // Google Calendar color ID (blueberry)
        bgClass: 'bg-blue-500',
        textClass: 'text-blue-400',
        borderClass: 'border-blue-500'
    },
    person3: {
        name: 'Person 3',
        color: '#a855f7',
        colorId: '3', // Google Calendar color ID (grape/purple)
        bgClass: 'bg-purple-500',
        textClass: 'text-purple-400',
        borderClass: 'border-purple-500'
    },
    person4: {
        name: 'Person 4',
        color: '#14b8a6',
        colorId: '7', // Google Calendar color ID (peacock/teal)
        bgClass: 'bg-teal-500',
        textClass: 'text-teal-400',
        borderClass: 'border-teal-500'
    },
    everyone: {
        name: 'Everyone',
        color: '#f59e0b',
        colorId: '5', // Google Calendar color ID (banana/yellow)
        bgClass: 'bg-amber-500',
        textClass: 'text-amber-400',
        borderClass: 'border-amber-500'
    }
};

// Calendar ID (your family calendar email)
export const CALENDAR_ID = 'your-calendar@gmail.com';
