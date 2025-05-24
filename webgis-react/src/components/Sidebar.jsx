import React from 'react';

export default function Sidebar({ isOpen, onToggle, children }) {
  return (
    <div className={isOpen ? '' : 'sidebar-hidden'}>
      <button id="toggle-sidebar" onClick={onToggle}>
        {isOpen ? '«' : '»'}
      </button>
      <aside id="sidebar">{children}</aside>
    </div>
  );
}