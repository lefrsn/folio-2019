export default class AccessibilityManager
{
    constructor()
    {
        this.liveRegion = null
        this.focusedElement = null
        
        this.createLiveRegion()
        this.setupKeyboardNavigation()
        console.log('[AccessibilityManager] Initialized')
    }

    createLiveRegion()
    {
        // ARIA live region for screen reader announcements
        this.liveRegion = document.createElement('div')
        this.liveRegion.setAttribute('role', 'status')
        this.liveRegion.setAttribute('aria-live', 'polite')
        this.liveRegion.setAttribute('aria-atomic', 'true')
        this.liveRegion.style.cssText = `
            position: absolute;
            left: -10000px;
            width: 1px;
            height: 1px;
            overflow: hidden;
        `
        document.body.appendChild(this.liveRegion)
        
        console.log('[AccessibilityManager] ARIA live region created')
    }

    announce(message)
    {
        // Clear and set new message for screen readers
        this.liveRegion.textContent = ''
        setTimeout(() => {
            this.liveRegion.textContent = message
            console.log('[AccessibilityManager] Announced:', message)
        }, 100)
    }

    setupKeyboardNavigation()
    {
        // Keyboard shortcuts for accessibility
        document.addEventListener('keydown', (e) => {
            // Tab - Announce current location
            if(e.key === 'Tab' && !e.shiftKey && !e.ctrlKey)
            {
                // Let default tab behavior work
            }
            
            // Escape - Return to menu/overview
            if(e.key === 'Escape')
            {
                this.announce('Returning to main menu')
            }
            
            // Arrow keys - Navigate pages
            if(e.key === 'ArrowLeft' || e.key === 'ArrowRight')
            {
                const direction = e.key === 'ArrowRight' ? 'next' : 'previous'
                this.announce(`Navigating to ${direction} page`)
            }
            
            // Enter - Activate focused element
            if(e.key === 'Enter')
            {
                this.announce('Activating element')
            }
            
            // Question mark - Help
            if(e.key === '?' && e.shiftKey)
            {
                this.showKeyboardHelp()
            }
        })
        
        console.log('[AccessibilityManager] Keyboard navigation setup complete')
    }

    showKeyboardHelp()
    {
        const helpText = `
            Keyboard shortcuts:
            - Arrow keys: Navigate pages
            - Enter: Activate focused element
            - Escape: Return to menu
            - Tab: Navigate interactive elements
            - Shift + ?: Show this help
        `
        this.announce(helpText)
        alert(helpText) // Also show visual help
    }

    announcePage(pageIndex, pageTitle)
    {
        this.announce(`Viewing page ${pageIndex + 1}: ${pageTitle}`)
    }

    announceInteraction(interactionType, label)
    {
        this.announce(`${interactionType}: ${label}`)
    }

    setFocusManagement(panels)
    {
        // Add tabindex to interactive panels
        panels.forEach((panel, index) => {
            if(panel.mesh)
            {
                // Create focus indicator
                panel.focusIndicator = document.createElement('div')
                panel.focusIndicator.setAttribute('role', 'button')
                panel.focusIndicator.setAttribute('aria-label', `Page ${index + 1}`)
                panel.focusIndicator.setAttribute('tabindex', '0')
                panel.focusIndicator.style.cssText = `
                    position: absolute;
                    left: -10000px;
                    width: 1px;
                    height: 1px;
                `
                
                panel.focusIndicator.addEventListener('focus', () => {
                    this.announcePage(index, `Page ${index + 1}`)
                })
                
                panel.focusIndicator.addEventListener('click', () => {
                    this.announce(`Activating page ${index + 1}`)
                })
                
                document.body.appendChild(panel.focusIndicator)
            }
        })
        
        console.log('[AccessibilityManager] Focus management set for', panels.length, 'panels')
    }

    updateFocusPosition(pageIndex)
    {
        // Update which element should receive focus
        this.announce(`Focused on page ${pageIndex + 1}`)
    }

    dispose()
    {
        if(this.liveRegion && this.liveRegion.parentElement)
        {
            this.liveRegion.parentElement.removeChild(this.liveRegion)
        }
    }
}
