import React from 'react';

export function TitleBar() {
  const handleControl = (command: string) => {
    const api = (window as any).electronAPI;
    if (api) {
      api.controlWindow(command);
    }
  };

  return (
    <div 
      className="h-8 flex items-center px-4 shrink-0 bg-[#0a0a0a] border-b border-white/5 w-full z-50 select-none"
      style={{ WebkitAppRegion: 'drag' } as any}
    >
      <div className="flex items-center gap-2" style={{ WebkitAppRegion: 'no-drag' } as any}>
        <button 
          onClick={() => handleControl('close')}
          className="w-3 h-3 rounded-full bg-[#ff5f56] hover:bg-[#ff5f56]/80 transition-colors focus:outline-none"
          title="Close"
        />
        <button 
          onClick={() => handleControl('minimize')}
          className="w-3 h-3 rounded-full bg-[#ffbd2e] hover:bg-[#ffbd2e]/80 transition-colors focus:outline-none"
          title="Minimize"
        />
        <button 
          onClick={() => handleControl('maximize')}
          className="w-3 h-3 rounded-full bg-[#27c93f] hover:bg-[#27c93f]/80 transition-colors focus:outline-none"
          title="Maximize"
        />
      </div>
      <div className="flex-1 flex justify-center items-center pointer-events-none pr-8">
        <span className="text-[10px] font-bold text-white/40 tracking-[0.2em] uppercase">Game Room Manager</span>
      </div>
    </div>
  );
}
