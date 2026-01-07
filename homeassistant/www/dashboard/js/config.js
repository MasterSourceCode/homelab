/**
 * Dashboard Configuration
 * Constants, entity mappings, and room/zone definitions
 */

// ============================================
// NETWORK CONFIGURATION
// ============================================

export const FRIGATE_LOCAL_URL = 'http://192.168.x.x:5003';
export const FRIGATE_EXTERNAL_URL = 'https://your-frigate-domain.com';
export const DEFAULT_LOCAL_HA_URL = 'http://192.168.x.x:8123';

// ============================================
// GOOGLE CALENDAR CONFIGURATION
// ============================================

export const GOOGLE_CALENDAR_API_KEY = 'YOUR_GOOGLE_API_KEY';
export const GOOGLE_CALENDAR_ID = 'familyfamilynames@gmail.com';
export const CALENDAR_TIMEZONE = 'Africa/Johannesburg';

// ============================================
// ENTITY IDS
// ============================================

export const GATE_COVER = 'cover.gate_switch_door_1';
export const GARAGE_COVER = 'cover.smart_garage_door_2311083729366461070548e1e9e12926_garage';
export const ALARM_PANEL = 'alarm_control_panel.alarm_partition_1';
export const ALARM_PIN = '9911';

// ============================================
// ENVISALINK_NEW PARTITION SENSORS
// ============================================
export const PARTITION_SENSORS = {
    ready: 'binary_sensor.alarm_partition_1_ready',
    acPower: 'binary_sensor.alarm_partition_1_ac_power',
    battery: 'binary_sensor.alarm_partition_1_panel_battery',
    health: 'binary_sensor.alarm_partition_1_panel_health',
    bell: 'binary_sensor.alarm_partition_1_system_bell',
    fire: 'binary_sensor.alarm_partition_1_fire',
    alarm: 'binary_sensor.alarm_partition_1_alarm',
    keypad: 'sensor.alarm_partition_1_keypad'
};

// Panic button entities
export const PANIC_BUTTONS = {
    police: 'button.alarm_panic_police',
    fire: 'button.alarm_panic_fire',
    ambulance: 'button.alarm_panic_ambulance'
};

// Camera entity mappings
export const CAMERA_ENTITIES = {
    front_door: 'switch.front_door_detect',
    backyard: 'switch.backyard_detect',
    aqara_g3: 'switch.aqara_g3_detect'
};

// Access control cameras
export const ACCESS_CAMERAS = {
    gate: { frigate: 'front_door', element: 'cam-gate' },
    garage: { frigate: 'wyze_garage', element: 'cam-garage' }
};

// Power sensors
export const POWER_SENSORS = [
    'sensor.sonoff_10018908af_power',
    'sensor.sonoff_100241aae6_power',
    'sensor.sonoff_100241ac8a_power',
    'sensor.sonoff_10017f2d90_power'
];

// Energy appliances
export const ENERGY_APPLIANCES = [
    { id: 'sensor.sonoff_10018908af_power', switch: 'switch.sonoff_10018908af', el: 'geyser', toggle: 'geyserToggle' },
    { id: 'sensor.sonoff_100241aae6_power', el: 'washer' },
    { id: 'sensor.sonoff_100241ac8a_power', el: 'dishwasher' },
    { id: 'sensor.sonoff_10017f2d90_power', switch: 'switch.sonoff_10017f2d90_1', el: 'pump', toggle: 'pumpToggle' }
];

// ============================================
// SOLARMAN INVERTER SENSORS (Deye Hybrid)
// ============================================

export const ENERGY_SENSORS = {
    // Solar PV
    solarPower: 'sensor.inverter_pv_power',
    solarPowerRaw: 'sensor.inverter_pv_power',
    pv1Power: 'sensor.inverter_pv1_power',
    pv2Power: 'sensor.inverter_pv2_power',
    pv1Voltage: 'sensor.inverter_pv1_voltage',
    pv2Voltage: 'sensor.inverter_pv2_voltage',
    solarToday: 'sensor.inverter_today_production',
    solarTotal: 'sensor.inverter_total_production',

    // Battery
    batteryPercent: 'sensor.inverter_battery',
    batteryPercentRaw: 'sensor.inverter_battery',
    batteryPower: 'sensor.inverter_battery_power',
    batteryPowerRaw: 'sensor.inverter_battery_power',
    batteryState: 'sensor.inverter_battery_state',
    batteryTemp: 'sensor.inverter_battery_temperature',
    batteryVoltage: 'sensor.inverter_battery_voltage',
    batteryCurrent: 'sensor.inverter_battery_current',
    batteryChargeToday: 'sensor.inverter_today_battery_charge',
    batteryDischargeToday: 'sensor.inverter_today_battery_discharge',

    // Grid
    gridPower: 'sensor.inverter_grid_power',
    gridPowerRaw: 'sensor.inverter_grid_power',
    gridVoltage: 'sensor.inverter_grid_l1_voltage',
    gridFrequency: 'sensor.inverter_grid_frequency',
    gridImportToday: 'sensor.inverter_today_energy_import',
    gridExportToday: 'sensor.inverter_today_energy_export',
    gridImportTotal: 'sensor.inverter_total_energy_import',
    gridExportTotal: 'sensor.inverter_total_energy_export',

    // Load/Consumption
    loadPower: 'sensor.inverter_load_power',
    loadPowerRaw: 'sensor.inverter_load_power',
    loadVoltage: 'sensor.inverter_load_l1_voltage',
    loadToday: 'sensor.inverter_today_load_consumption',
    loadTotal: 'sensor.inverter_total_load_consumption',

    // Appliance Power Monitors
    washerPower: 'sensor.sonoff_100241aae6_power',
    washerEnergy: 'sensor.sonoff_100241aae6_energy',
    dishwasherPower: 'sensor.sonoff_100241ac8a_power',
    dishwasherEnergy: 'sensor.sonoff_100241ac8a_energy',

    // Inverter
    inverterPower: 'sensor.inverter_power',
    inverterTemp: 'sensor.inverter_dc_temperature',
    inverterState: 'sensor.inverter_device_state',

    // Connection monitoring
    connectionStatus: 'sensor.inverter_connection_status',
    dataAge: 'sensor.inverter_data_age'
};

// ============================================
// ROOM DEFINITIONS
// ============================================

export const ROOMS = {
    ground: [
        { id: 'kitchen', name: 'Kitchen', icon: 'utensils', color: 'bg-orange-500', lights: ['switch.sonoff_100176c107_1', 'switch.sonoff_100176c107_2', 'switch.sonoff_100176c107_3'] },
        { id: 'living', name: 'Living Room', icon: 'sofa', color: 'bg-blue-500', lights: ['switch.sonoff_1001508021_1', 'switch.sonoff_1001508021_2'] },
        {
            id: 'entry',
            name: 'Entry',
            icon: 'door',
            color: 'bg-purple-500',
            lights: ['switch.sonoff_1001de76ac_1', 'switch.sonoff_1001de76ac_2'],
            lightNames: ['Chandelier', 'Down Lights']
        },
        { id: 'hallway', name: 'Hallway', icon: 'route', color: 'bg-teal-500', lights: ['switch.sonoff_1001eb21e6_1'] },
        { id: 'garage', name: 'Garage', icon: 'car', color: 'bg-amber-500', lights: ['switch.garage_switch'], hasDoor: true },
    ],
    upper: [
        {
            id: 'main_bed',
            name: 'Main Bedroom',
            icon: 'bed',
            color: 'bg-indigo-500',
            image: '/local/dashboard/Person2.png',
            lights: ['switch.sonoff_1001e80ff3_1', 'switch.sonoff_1001e80ff3_2', 'switch.sonoff_1001e80ff3_3'],
            zones: [
                { name: 'Bedroom', lights: ['switch.sonoff_1001e80ff3_1', 'switch.sonoff_1001e80ff3_2', 'switch.sonoff_1001e80ff3_3'] },
            ]
        },
        {
            id: 'child1',
            name: "Child1's Room",
            icon: 'star',
            color: 'bg-pink-500',
            image: '/local/dashboard/Child1.png',
            lights: ['switch.sonoff_1001508fc5_1', 'switch.sonoff_1001508fc5_2', 'switch.sonoff_1001eb1d06_1'],
            zones: [
                { name: 'Bedroom', lights: ['switch.sonoff_1001508fc5_1', 'switch.sonoff_1001508fc5_2'] },
                { name: 'Bathroom', lights: ['switch.sonoff_1001eb1d06_1'] }
            ]
        },
        {
            id: 'child2',
            name: "Child2's Room",
            icon: 'heart',
            color: 'bg-rose-500',
            image: '/local/dashboard/Child2.png',
            lights: ['switch.mila_bedroom_light', 'switch.sonoff_1001eb2228_1'],
            zones: [
                { name: 'Bedroom', lights: ['switch.mila_bedroom_light'] },
                { name: 'Bathroom', lights: ['switch.sonoff_1001eb2228_1'] }
            ]
        },
        { id: 'upstairs_hall', name: 'Upstairs Hall', icon: 'stairs', color: 'bg-violet-500', lights: ['switch.sonoff_1001eb24e5_1'] },
    ]
};

// Get all lights from all rooms
export const getAllLights = () => {
    return [...ROOMS.ground, ...ROOMS.upper].flatMap(r => r.lights);
};

// ============================================
// SECURITY ZONES
// ============================================

export const ZONES = [
    // Entry zones (envisalink_new entity format: binary_sensor.alarm_zone_XX)
    // Each zone includes faultId for zone sensor health monitoring
    { id: 'binary_sensor.alarm_zone_11', faultId: 'binary_sensor.alarm_zone_11_fault', name: 'Front Door', icon: 'door', camera: 'front_door', location: 'entry', zoneNum: 11 },
    { id: 'binary_sensor.alarm_zone_26', faultId: 'binary_sensor.alarm_zone_26_fault', name: 'Main Entrance', icon: 'gate', camera: 'front_door', location: 'entry', zoneNum: 26 },
    // Interior zones
    { id: 'binary_sensor.alarm_zone_10', faultId: 'binary_sensor.alarm_zone_10_fault', name: 'Kitchen', icon: 'kitchen', location: 'interior', zoneNum: 10 },
    { id: 'binary_sensor.alarm_zone_12', faultId: 'binary_sensor.alarm_zone_12_fault', name: 'Garage', icon: 'garage', camera: 'wyze_garage', location: 'interior', zoneNum: 12 },
    { id: 'binary_sensor.alarm_zone_24', faultId: 'binary_sensor.alarm_zone_24_fault', name: 'TV Room', icon: 'tv', location: 'interior', zoneNum: 24 },
    { id: 'binary_sensor.alarm_zone_14', faultId: 'binary_sensor.alarm_zone_14_fault', name: 'Main Bedroom', icon: 'bed', location: 'interior', zoneNum: 14 },
    { id: 'binary_sensor.alarm_zone_15', faultId: 'binary_sensor.alarm_zone_15_fault', name: 'Child2 Room', icon: 'child', location: 'interior', zoneNum: 15 },
    { id: 'binary_sensor.alarm_zone_16', faultId: 'binary_sensor.alarm_zone_16_fault', name: 'Child1', icon: 'child', location: 'interior', zoneNum: 16 },
    // Exterior zones
    { id: 'binary_sensor.alarm_zone_7', faultId: 'binary_sensor.alarm_zone_7_fault', name: 'Outside Scullery', icon: 'exterior', location: 'exterior', zoneNum: 7 },
    { id: 'binary_sensor.alarm_zone_17', faultId: 'binary_sensor.alarm_zone_17_fault', name: 'Outside Scullery 2', icon: 'exterior', location: 'exterior', zoneNum: 17 },
    { id: 'binary_sensor.alarm_zone_21', faultId: 'binary_sensor.alarm_zone_21_fault', name: 'Pool', icon: 'pool', camera: 'backyard', location: 'exterior', zoneNum: 21 },
    { id: 'binary_sensor.alarm_zone_18', faultId: 'binary_sensor.alarm_zone_18_fault', name: 'Pool Pump', icon: 'pump', camera: 'backyard', location: 'exterior', zoneNum: 18 },
    { id: 'binary_sensor.alarm_zone_19', faultId: 'binary_sensor.alarm_zone_19_fault', name: 'Main Balcony', icon: 'balcony', camera: 'backyard', location: 'exterior', zoneNum: 19 },
    { id: 'binary_sensor.alarm_zone_23', faultId: 'binary_sensor.alarm_zone_23_fault', name: 'Outside Garage', icon: 'exterior', camera: 'front_door', location: 'exterior', zoneNum: 23 },
    { id: 'binary_sensor.alarm_zone_22', faultId: 'binary_sensor.alarm_zone_22_fault', name: 'Child1 Balcony', icon: 'balcony', location: 'exterior', zoneNum: 22 },
    { id: 'binary_sensor.alarm_zone_27', faultId: 'binary_sensor.alarm_zone_27_fault', name: 'Child1 Balcony 2', icon: 'balcony', location: 'exterior', zoneNum: 27 },
];

// ============================================
// ZONE ICONS (SVG paths)
// ============================================

export const ZONE_ICONS = {
    kitchen: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/>',
    door: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z"/>',
    garage: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/>',
    bed: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/>',
    child: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>',
    pool: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"/>',
    tv: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>',
    balcony: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>',
    exterior: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>',
    gate: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4"/>',
    pump: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"/>',
    motion: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>'
};

// ============================================
// ROOM ICONS (SVG paths)
// ============================================

export const ICONS = {
    utensils: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"/>',
    sofa: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/>',
    door: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z"/>',
    route: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"/>',
    car: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/>',
    pool: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"/>',
    bed: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/>',
    star: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"/>',
    heart: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/>',
    stairs: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/>',
    bath: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z"/>',
    light: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>'
};

// ============================================
// TIMING CONFIGURATION
// ============================================

export const REFRESH_RATES = {
    camerasLocal: 700,      // ~1.5 fps on local network
    camerasExternal: 2000,  // Slower for external access
    clock: 1000,            // 1 second
    reconnect: 5000         // 5 seconds
};

// ============================================
// MEDIA / FIRE TV CONFIGURATION
// ============================================

export const FIRE_TV_DEVICES = {
    living_room: {
        id: 'living_room',
        name: 'Living Room Fire TV',
        entityId: 'media_player.fire_tv_192_168_68_111',
        icon: 'tv',
        location: 'living'
    }
};

// Default device (only one Fire TV)
export const DEFAULT_FIRE_TV = 'living_room';

export const STREAMING_SERVICES = {
    netflix: {
        id: 'netflix',
        name: 'Netflix',
        packageName: 'com.netflix.ninja',
        launchIntent: 'am start -n com.netflix.ninja/.MainActivity',
        // Deep link directly to episode: netflix://title/{id}?s={season}&e={episode}
        episodeDeepLink: 'am start -a android.intent.action.VIEW -d "netflix://title/{netflixId}?s={season}&e={episode}" -n com.netflix.ninja/.MainActivity',
        color: '#E50914',
        icon: 'N'
    },
    prime: {
        id: 'prime',
        name: 'Prime Video',
        packageName: 'com.amazon.avod',
        launchIntent: 'am start -n com.amazon.avod/.PlaybackActivity',
        color: '#00A8E1',
        icon: 'P'
    },
    disney: {
        id: 'disney',
        name: 'Disney+',
        packageName: 'com.disney.disneyplus',
        launchIntent: 'am start -n com.disney.disneyplus/.StartupActivity',
        color: '#113CCF',
        icon: 'D+'
    },
    hbo: {
        id: 'hbo',
        name: 'Max',
        packageName: 'com.hbo.hbonow',
        launchIntent: 'am start -n com.hbo.hbonow/.MainActivity',
        color: '#5822B4',
        icon: 'M'
    },
    watchlist_pro: {
        id: 'watchlist_pro',
        name: 'WP Watchlist',
        packageName: 'com.vod.watchlist.tvapp',
        launchIntent: 'am start -n com.vod.watchlist.tvapp/.normal',
        color: '#8B5CF6',
        icon: 'W'
    },
    unknown: {
        id: 'unknown',
        name: 'Unknown',
        packageName: null,
        launchIntent: null,
        color: '#666666',
        icon: '?'
    }
};

// Netflix IDs for deep linking to specific shows
export const NETFLIX_IDS = {
    'stranger-things': '80057281'
};

// Cinema Mode - All lights to turn off during playback
export const CINEMA_MODE_LIGHTS = [
    // Living Room
    'switch.sonoff_1001508021_1',
    'switch.sonoff_1001508021_2',
    // Entry/Cinema
    'switch.sonoff_1001de76ac_1',
    'switch.sonoff_1001de76ac_2',
    // Kitchen (ambient light during movies)
    'switch.sonoff_100176c107_1',
    'switch.sonoff_100176c107_2',
    'switch.sonoff_100176c107_3',
    // Hallway
    'switch.sonoff_1001eb21e6_1'
];

export const MEDIA_CONFIG = {
    watchlistPath: '/local/dashboard/data/watchlist.json',
    defaultPosterPlaceholder: '/local/dashboard/images/poster-placeholder.png'
};

// ============================================
// FAMILY MEMBERS CONFIGURATION
// ============================================

export const FAMILY_MEMBERS = {
    person2: {
        name: 'Person2',
        color: '#ec4899',
        avatar: '/local/dashboard/Person2.png',
        sensors: {
            tracker: 'person.person2',
            battery: 'sensor.tatiana_iphone_battery_level',
            batteryState: 'sensor.tatiana_iphone_battery_state',
            steps: 'sensor.tatiana_iphone_steps',
            floorsUp: 'sensor.tatiana_iphone_floors_ascended',
            floorsDown: 'sensor.tatiana_iphone_floors_descended',
            distance: 'sensor.tatiana_iphone_distance',
            activity: 'sensor.tatiana_iphone_activity',
            focus: 'binary_sensor.tatiana_iphone_focus',
            location: 'sensor.tatiana_iphone_geocoded_location'
        }
    },
    person1: {
        name: 'Person1',
        color: '#3b82f6',
        avatar: '/local/dashboard/Person1.jpeg',
        sensors: {
            tracker: 'person.person1',
            battery: 'sensor.nico_battery_level',
            batteryState: 'sensor.nico_battery_state',
            steps: 'sensor.nico_steps',
            floorsUp: 'sensor.nico_floors_ascended',
            floorsDown: 'sensor.nico_floors_descended',
            distance: 'sensor.nico_distance',
            activity: 'sensor.nico_activity',
            focus: 'binary_sensor.nico_focus',
            location: 'sensor.nico_geocoded_location'
        }
    },
    child1: {
        name: 'Child1',
        color: '#a855f7',
        avatar: '/local/dashboard/Child1.png',
        sensors: {
            tracker: 'person.child1',
            battery: 'sensor.alexandra_iphone_battery_level',
            batteryState: 'sensor.alexandra_iphone_battery_state',
            steps: 'sensor.alexandra_iphone_steps',
            floorsUp: 'sensor.alexandra_iphone_floors_ascended',
            floorsDown: 'sensor.alexandra_iphone_floors_descended',
            distance: 'sensor.alexandra_iphone_distance',
            activity: 'sensor.alexandra_iphone_activity',
            focus: 'binary_sensor.alexandra_iphone_focus',
            location: 'sensor.alexandra_iphone_geocoded_location'
        }
    },
    child2: {
        name: 'Child2',
        color: '#14b8a6',
        avatar: '/local/dashboard/Child2.png',
        sensors: {
            tracker: 'person.child2',
            battery: 'sensor.milas_iphone_battery_level',
            batteryState: 'sensor.milas_iphone_battery_state',
            steps: 'sensor.milas_iphone_steps',
            floorsUp: 'sensor.milas_iphone_floors_ascended',
            floorsDown: 'sensor.milas_iphone_floors_descended',
            distance: 'sensor.milas_iphone_distance',
            activity: 'sensor.milas_iphone_activity',
            focus: 'binary_sensor.milas_iphone_focus',
            location: 'sensor.milas_iphone_geocoded_location'
        }
    }
};

export const FAMILY_CONFIG = {
    lowBatteryThreshold: 20,
    criticalBatteryThreshold: 10
};
