import React, { useState } from 'react';
import {
    LayoutDashboard,
    Database,
    TestTube,
    DoorOpen,
    Thermometer,
    Utensils,
    Menu,
    X,
    Activity,
    Wifi
} from 'lucide-react';

const DashboardLayout = ({ children, activeTab, setActiveTab, connected }) => {
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);

    const menuItems = [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { id: 'data', label: 'Sensor Data', icon: Database },
        { id: 'test', label: 'Test Analysis', icon: TestTube },
        { id: 'gate', label: 'Gate Monitor', icon: DoorOpen },
        { id: 'environment', label: 'Environment', icon: Thermometer },
        { id: 'feed', label: 'Feed & Water', icon: Utensils },
    ];

    return (
        <div className="flex h-screen bg-gray-50 overflow-hidden">
            {/* Sidebar */}
            <aside
                className={`bg-white shadow-xl z-30 transition-all duration-300 ease-in-out flex flex-col
          ${isSidebarOpen ? 'w-64' : 'w-20'}
        `}
            >
                {/* Logo Area */}
                <div className="h-20 flex items-center justify-center border-b border-gray-100 relative">
                    <div className="flex items-center space-x-2 overflow-hidden px-4">
                        <span className="text-3xl animate-bounce">🐄</span>
                        {isSidebarOpen && (
                            <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600 whitespace-nowrap">
                                CattleNet
                            </span>
                        )}
                    </div>
                    <button
                        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                        className="absolute right-0 top-1/2 transform -translate-y-1/2 translate-x-1/2 bg-white border border-gray-200 rounded-full p-1 shadow-md hover:bg-gray-50 text-gray-500"
                    >
                        {isSidebarOpen ? <X size={14} /> : <Menu size={14} />}
                    </button>
                </div>

                {/* Navigation */}
                <nav className="flex-1 overflow-y-auto py-6 px-3 space-y-2">
                    {menuItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = activeTab === item.id;

                        return (
                            <button
                                key={item.id}
                                onClick={() => setActiveTab(item.id)}
                                className={`w-full flex items-center p-3 rounded-xl transition-all duration-200 group relative
                  ${isActive
                                        ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-200'
                                        : 'text-gray-600 hover:bg-blue-50 hover:text-blue-600'
                                    }
                `}
                            >
                                <Icon size={24} className={`${isActive ? 'text-white' : 'text-gray-500 group-hover:text-blue-600'} min-w-[24px]`} />

                                <span className={`ml-3 font-medium transition-all duration-300 overflow-hidden whitespace-nowrap
                  ${isSidebarOpen ? 'opacity-100 w-auto' : 'opacity-0 w-0'}
                `}>
                                    {item.label}
                                </span>

                                {/* Tooltip for collapsed state */}
                                {!isSidebarOpen && (
                                    <div className="absolute left-full ml-4 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50">
                                        {item.label}
                                    </div>
                                )}
                            </button>
                        );
                    })}
                </nav>

                {/* Footer Status */}
                <div className="p-4 border-t border-gray-100">
                    <div className={`flex items-center justify-center p-3 rounded-xl transition-colors
            ${connected ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}
          `}>
                        {connected ? <Wifi size={20} /> : <Activity size={20} />}
                        {isSidebarOpen && (
                            <div className="ml-3 text-xs font-medium">
                                <p>{connected ? 'System Online' : 'Disconnected'}</p>
                                <p className="opacity-75">ESP8266 Active</p>
                            </div>
                        )}
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 overflow-y-auto relative">
                {/* Header */}
                <header className="bg-white/80 backdrop-blur-md sticky top-0 z-20 px-8 py-4 border-b border-gray-200 flex justify-between items-center">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-800 capitalize">
                            {menuItems.find(i => i.id === activeTab)?.label}
                        </h2>
                        <p className="text-sm text-gray-500">Real-time Farm Monitoring System</p>
                    </div>

                    <div className="flex items-center space-x-4">
                        <div className="text-right hidden md:block">
                            <p className="text-sm font-semibold text-gray-700">{new Date().toLocaleDateString()}</p>
                            <p className="text-xs text-gray-500">{new Date().toLocaleTimeString()}</p>
                        </div>
                        <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold shadow-lg">
                            A
                        </div>
                    </div>
                </header>

                {/* Content Area */}
                <div className="p-8">
                    {children}
                </div>
            </main>
        </div>
    );
};

export default DashboardLayout;
