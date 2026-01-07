/**
 * Dashboard Configuration
 * Declarative configuration for the entire dashboard
 *
 * This file defines:
 * - Views and their layouts
 * - Components used in each view
 * - Navigation structure
 * - Entity mappings
 * - Theming
 */

export const dashboardConfig = {
    // Metadata
    version: '2.0.0',
    name: 'Smart Home Dashboard',

    // Theme configuration
    theme: {
        name: 'neo-tokyo-dark',
        colors: {
            primary: 'var(--color-purple)',
            secondary: 'var(--color-cyan)',
            accent: 'var(--color-amber)'
        }
    },

    // Navigation items
    navigation: {
        type: 'bottom',
        items: [
            { id: 'home', icon: 'home', label: 'Home' },
            { id: 'cameras', icon: 'camera', label: 'Cams' },
            { id: 'calendar', icon: 'calendar', label: 'Calendar' },
            { id: 'security', icon: 'shield', label: 'Secure' },
            { id: 'more', icon: 'menu', label: 'More' }
        ],
        moreMenu: [
            { id: 'surveillance', icon: 'camera', label: 'AI Surveillance', color: 'purple' },
            { id: 'guest-pass', icon: 'ticket', label: 'Guest Pass', color: 'amber' },
            { id: 'family', icon: 'users', label: 'Family', color: 'cyan' },
            { id: 'energy', icon: 'power', label: 'Energy', color: 'emerald' },
            { id: 'settings', icon: 'cog', label: 'Settings', color: 'blue' }
        ]
    },

    // Status bar configuration
    statusBar: {
        showTime: true,
        showDate: true,
        showWeather: true,
        pills: [
            {
                id: 'lights',
                type: 'lights',
                icon: 'lightbulb',
                label: 'Lights',
                action: 'showAllLights'
            },
            {
                id: 'security',
                type: 'security',
                icon: 'shield',
                label: 'Alarm',
                entityId: 'alarm_control_panel.alarm_partition_1',
                action: 'showSecurity'
            },
            {
                id: 'power',
                type: 'power',
                icon: 'power',
                label: 'Power',
                action: 'showEnergy'
            },
            {
                id: 'temperature',
                type: 'temperature',
                icon: 'sun',
                label: 'Outside',
                entityId: 'weather.home',
                action: 'showWeather'
            }
        ]
    },

    // Views configuration
    views: {
        home: {
            title: 'Home',
            layout: 'grid',
            components: [
                {
                    type: 'StatusBar',
                    id: 'status-bar',
                    props: { showPills: true }
                },
                {
                    type: 'FloorSelector',
                    id: 'floor-selector',
                    props: {
                        floors: ['Ground', 'First']
                    }
                },
                {
                    type: 'RoomGrid',
                    id: 'room-grid',
                    props: {
                        columns: 2,
                        gap: 'md'
                    }
                }
            ]
        },
        cameras: {
            title: 'Cameras',
            layout: 'stack',
            components: [
                { type: 'CameraFeed', id: 'gate-camera', props: { cameraId: 'front_door', title: 'Front Gate' } },
                { type: 'CoverControl', id: 'gate-control', props: { entityId: 'cover.gate_switch_door_1' } },
                { type: 'CameraFeed', id: 'garage-camera', props: { cameraId: 'wyze_garage', title: 'Garage' } },
                { type: 'CoverControl', id: 'garage-control', props: { entityId: 'cover.smart_garage_door_2311083729366461070548e1e9e12926_garage' } }
            ]
        },
        security: {
            title: 'Security',
            layout: 'stack',
            components: [
                { type: 'AlarmPanel', id: 'alarm-panel', props: { entityId: 'alarm_control_panel.alarm_partition_1' } },
                { type: 'ZoneGrid', id: 'zone-grid', props: {} }
            ]
        },
        calendar: {
            title: 'Calendar',
            layout: 'stack',
            components: [
                { type: 'CalendarHeader', id: 'cal-header' },
                { type: 'AgendaView', id: 'agenda' }
            ]
        },
        surveillance: {
            title: 'AI Surveillance',
            layout: 'stack',
            components: [
                { type: 'SurveillanceStats', id: 'surv-stats' },
                { type: 'SurveillanceFilters', id: 'surv-filters' },
                { type: 'SurveillanceEventList', id: 'surv-events' }
            ]
        },
        'guest-pass': {
            title: 'Guest Pass',
            layout: 'stack',
            components: [
                { type: 'GuestPassHeader', id: 'guest-header' },
                { type: 'DurationPresets', id: 'duration-presets' },
                { type: 'GuestPassForm', id: 'guest-form' },
                { type: 'ActivePassList', id: 'active-passes' }
            ]
        },
        energy: {
            title: 'Energy',
            layout: 'stack',
            components: [
                { type: 'EnergyChart', id: 'energy-chart' },
                { type: 'EnergyStats', id: 'energy-stats' }
            ]
        }
    },

    // Rooms configuration
    rooms: {
        ground: [
            {
                id: 'entrance',
                name: 'Entrance',
                icon: 'home',
                lights: ['light.entrance_light'],
                image: null
            },
            {
                id: 'kitchen',
                name: 'Kitchen',
                icon: 'home',
                lights: ['light.kitchen_main', 'light.kitchen_counter'],
                scenes: [
                    { id: 'cooking', name: 'Cooking' },
                    { id: 'dinner', name: 'Dinner' }
                ]
            },
            {
                id: 'lounge',
                name: 'Lounge',
                icon: 'tv',
                lights: ['light.lounge_main', 'light.lounge_lamp'],
                scenes: [
                    { id: 'movie', name: 'Movie' },
                    { id: 'relax', name: 'Relax' }
                ]
            },
            {
                id: 'dining',
                name: 'Dining',
                icon: 'home',
                lights: ['light.dining_room']
            }
        ],
        first: [
            {
                id: 'master',
                name: 'Master Bedroom',
                icon: 'moon',
                lights: ['light.master_bedroom', 'light.master_lamp']
            },
            {
                id: 'bedroom2',
                name: 'Bedroom 2',
                icon: 'moon',
                lights: ['light.bedroom_2']
            },
            {
                id: 'bedroom3',
                name: 'Bedroom 3',
                icon: 'moon',
                lights: ['light.bedroom_3']
            },
            {
                id: 'bathroom',
                name: 'Bathroom',
                icon: 'home',
                lights: ['light.bathroom']
            }
        ]
    },

    // Entity mappings
    entities: {
        alarm: 'alarm_control_panel.alarm_partition_1',
        gate: 'cover.gate_switch_door_1',
        garage: 'cover.smart_garage_door_2311083729366461070548e1e9e12926_garage',
        weather: 'weather.home',
        blink: 'alarm_control_panel.blink_13_townsend_unit_1',
        dogMode: 'input_boolean.dog_mode',
        camerasArmed: 'input_boolean.cameras_armed',
        guestMode: 'input_boolean.guest_mode'
    },

    // Camera configuration
    cameras: {
        frigate: [
            { id: 'front_door', name: 'Front Door', detectEntity: 'switch.front_door_detect' },
            { id: 'backyard', name: 'Backyard', detectEntity: 'switch.backyard_detect' },
            { id: 'wyze_garage', name: 'Garage', detectEntity: 'switch.wyze_garage_detect' },
            { id: 'ezviz_indoor', name: 'Indoor', detectEntity: 'switch.ezviz_indoor_detect' }
        ],
        blink: [
            { id: 'front_door_2', name: 'Blink Front', powered: true },
            { id: 'garagecam', name: 'Blink Garage', powered: true },
            { id: 'poolcam', name: 'Pool', powered: false },
            { id: 'tvcam', name: 'TV Room', powered: false },
            { id: 'kitchencam', name: 'Kitchen', powered: false }
        ]
    },

    // Feature flags
    features: {
        aiAnalysis: true,
        googleCalendar: true,
        guestPass: true,
        familyTracking: true,
        energyMonitoring: true,
        blinkIntegration: true
    },

    // API endpoints
    api: {
        frigate: {
            local: 'http://192.168.68.77:5003',
            external: 'https://your-frigate-domain.com'
        },
        homeAssistant: {
            local: 'http://192.168.68.77:8123',
            nabuCasa: 'https://your-instance.ui.nabu.casa'
        }
    }
};

export default dashboardConfig;
