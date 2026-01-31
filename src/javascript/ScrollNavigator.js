import * as THREE from 'three'
import gsap from 'gsap'

export default class ScrollNavigator
{
    constructor(_options)
    {
        // Options
        this.camera = _options.camera
        this.target = _options.target // The object to navigate around
        this.time = _options.time
        this.debug = _options.debug
        this.accessibilityManager = _options.accessibilityManager // For ARIA announcements
        
        // Settings
        this.enabled = true // Start enabled
        this.scrollDepth = 0 // Current scroll position (0 to 1)
        this.targetScrollDepth = 0
        this.maxDepth = 30 // Maximum depth to travel
        this.startZ = 0 // Starting Z position
        this.sensitivity = 0.0001 // Scroll sensitivity (reduced for slower movement)
        this.smoothness = 0.1 // Lerp factor for smooth movement
        this.transitionSpeed = 0.3 // Fast transitions between pages
        this.currentPageIndex = 0 // Which page we're currently on
        this.targetPageIndex = 0 // Which page we're transitioning to
        this.isFocusingPage = false // Whether camera is focused on a page
        this.focusedPageIndex = -1 // Which page is focused (-1 = none)
        this.focusStartPosition = null // Starting position when focus begins
        this.focusTargetPosition = null // Target position for focusing
        this.focusProgress = 0 // Progress along the path (0 to 1)
        this.panels = null // Reference to actual panel meshes from demoRoom
        
        // Store initial camera position
        this.initialPosition = {
            x: 0,
            y: 3,
            z: 0
        }
        
        // Set camera to initial position
        this.camera.instance.position.set(0, 3, 0)
        this.camera.mode = 'free'
        
        console.log('[ScrollNavigator] initialized, camera set to free mode at (0, 3, 0)')
        
        this.setListeners()
        this.setUpdate()
    }

    setListeners()
    {
        console.log('[ScrollNavigator] setListeners() called')
        
        // Mouse wheel event
        window.addEventListener('wheel', (event) =>
        {
            // Don't prevent default if 2D view is active
            if(document.querySelector('.view-2d-container')?.style.display === 'block')
            {
                return
            }
            
            console.log('[ScrollNavigator] wheel event detected! deltaY:', event.deltaY)
            
            event.preventDefault()
            
            // If we're focused on a page, scroll within that page
            if(this.isFocusingPage && this.panels && this.panels[this.focusedPageIndex])
            {
                const panel = this.panels[this.focusedPageIndex]
                
                // Check if panel is scrollable
                if(panel.maxScroll && panel.maxScroll > 0)
                {
                    // Scroll within the page
                    const scrollAmount = event.deltaY * 0.5 // Adjust sensitivity
                    const newScrollY = panel.scrollY + scrollAmount
                    
                    if(panel.scrollTo)
                    {
                        panel.scrollTo(newScrollY)
                        console.log('[ScrollNavigator] Scrolled page', this.focusedPageIndex, 'to Y:', panel.scrollY.toFixed(2))
                    }
                    
                    return // Don't navigate to other pages
                }
            }
            
            console.log('[ScrollNavigator] wheel event processing:', event.deltaY)
            
            // Update target scroll depth (navigate between pages)
            this.targetScrollDepth += event.deltaY * this.sensitivity
            
            // Clamp between 0 and 1
            this.targetScrollDepth = Math.max(0, Math.min(1, this.targetScrollDepth))
            
            console.log('[ScrollNavigator] targetScrollDepth:', this.targetScrollDepth.toFixed(3))
            
        }, { passive: false })

        // Keyboard navigation (arrow keys)
        window.addEventListener('keydown', (event) =>
        {
            console.log('[ScrollNavigator] keydown event:', event.key)
            
            // If focused on a page, use arrow keys for page scrolling
            if(this.isFocusingPage && this.panels && this.panels[this.focusedPageIndex])
            {
                const panel = this.panels[this.focusedPageIndex]
                
                if(panel.maxScroll && panel.maxScroll > 0)
                {
                    if(event.key === 'ArrowDown')
                    {
                        const scrollAmount = 50 // Pixels to scroll
                        if(panel.scrollTo)
                        {
                            panel.scrollTo(panel.scrollY + scrollAmount)
                            console.log('[ScrollNavigator] Arrow down: scrolled page to', panel.scrollY)
                        }
                        return
                    }
                    else if(event.key === 'ArrowUp')
                    {
                        const scrollAmount = 50 // Pixels to scroll
                        if(panel.scrollTo)
                        {
                            panel.scrollTo(panel.scrollY - scrollAmount)
                            console.log('[ScrollNavigator] Arrow up: scrolled page to', panel.scrollY)
                        }
                        return
                    }
                }
            }
            
            // Otherwise, navigate between pages
            if (event.key === 'ArrowDown' || event.key === 's')
            {
                this.targetScrollDepth += 0.05
                this.targetScrollDepth = Math.min(1, this.targetScrollDepth)
                console.log('[ScrollNavigator] Arrow down pressed, targetScrollDepth:', this.targetScrollDepth.toFixed(3))
            }
            else if (event.key === 'ArrowUp' || event.key === 'w')
            {
                this.targetScrollDepth -= 0.05
                this.targetScrollDepth = Math.max(0, this.targetScrollDepth)
                console.log('[ScrollNavigator] Arrow up pressed, targetScrollDepth:', this.targetScrollDepth.toFixed(3))
            }
        })
        
        console.log('[ScrollNavigator] Event listeners set up')
    }

    setUpdate()
    {
        this.time.on('tick', () =>
        {
            if (this.isFocusingPage)
            {
                // Camera is focused on a specific page
                const radius = 7 // Circle radius (must match HTMLTo3D)
                const centerY = 0 // Center of circle
                
                // Get actual page position from mesh if available
                let pageX, pageY, pageZ, pageCenter
                
                if (this.panels && this.panels[this.focusedPageIndex])
                {
                    // Use actual mesh world position
                    const panel = this.panels[this.focusedPageIndex]
                    panel.mesh.updateMatrixWorld(true)
                    pageCenter = new THREE.Vector3()
                    panel.mesh.getWorldPosition(pageCenter)
                    pageX = pageCenter.x
                    pageY = pageCenter.y
                    pageZ = pageCenter.z
                }
                else
                {
                    // Fallback to calculated position
                    const totalPages = 8
                    const angle = (this.focusedPageIndex / totalPages) * Math.PI * 2
                    pageX = Math.sin(angle) * radius
                    pageY = Math.cos(angle) * radius + centerY
                    pageZ = 1.5
                    pageCenter = new THREE.Vector3(pageX, pageY, pageZ)
                }
                
                // Calculate angle to page in XY plane
                const angle = Math.atan2(pageX, pageY - centerY)
                
                // Camera position: Position close to page so it fills the view
                // Calculate inward direction (toward center from page)
                const inwardX = -Math.sin(angle)
                const inwardY = -Math.cos(angle)
                
                // Place camera 1.0 unit in front of the page (inward from page position)
                const distanceFromPage = 1.0
                const targetCameraX = pageX + inwardX * distanceFromPage
                const targetCameraY = pageY + inwardY * distanceFromPage
                const targetCameraZ = pageZ // Same height as page center for straight-on view
                
                // If we just started focusing OR target changed, update positions
                const targetPosition = new THREE.Vector3(targetCameraX, targetCameraY, targetCameraZ)
                
                if (!this.focusStartPosition || !this.focusTargetPosition || 
                    !this.focusTargetPosition.equals(targetPosition))
                {
                    // Starting from current camera position
                    this.focusStartPosition = this.camera.instance.position.clone()
                    this.focusTargetPosition = targetPosition
                    this.focusProgress = 0
                }
                
                // Interpolate along the path from start to target
                this.focusProgress += (1 - this.focusProgress) * 0.05
                
                this.camera.instance.position.lerpVectors(
                    this.focusStartPosition,
                    this.focusTargetPosition,
                    this.focusProgress
                )
                
                // Look at the page center (already defined above)
                this.camera.instance.lookAt(pageCenter)
            }
            else
            {
                // Camera moves around the circle (orbiting)
                this.scrollDepth += (this.targetScrollDepth - this.scrollDepth) * this.smoothness
                
                const maxPages = 8
                const orbitRadius = 5 // Camera orbit radius (inside the page circle)
                
                // Calculate angle based on scroll depth
                const orbitAngle = this.scrollDepth * Math.PI * 2 // Full rotation
                
                // Camera position on circle
                const targetX = Math.sin(orbitAngle) * orbitRadius
                const targetY = Math.cos(orbitAngle) * orbitRadius
                const targetZ = 0
                
                // Smoothly move to target position
                this.camera.instance.position.x += (targetX - this.camera.instance.position.x) * 0.1
                this.camera.instance.position.y += (targetY - this.camera.instance.position.y) * 0.1
                this.camera.instance.position.z = targetZ
                
                // Face outward from center
                this.camera.instance.rotation.z = 0
                const lookAtTarget = new THREE.Vector3(
                    Math.sin(orbitAngle) * 15,
                    Math.cos(orbitAngle) * 15,
                    0
                )
                this.camera.instance.lookAt(lookAtTarget)
            }
        })
    }

    /**
     * Enable scroll navigation in a room
     * @param {Object} options
     * @param {number} options.startZ - Starting Z position
     * @param {number} options.maxDepth - Maximum depth to travel
     * @param {Object} options.startPosition - Camera starting position {x, y, z}
     */
    enable(options = {})
    {
        console.log('[ScrollNavigator] enable() called with options:', options)
        console.log('[ScrollNavigator] BEFORE enable - this.enabled:', this.enabled)
        
        this.enabled = true
        
        console.log('[ScrollNavigator] AFTER setting - this.enabled:', this.enabled)
        
        this.startZ = options.startZ || 0
        this.maxDepth = options.maxDepth || 30
        
        // Reset scroll depth
        this.scrollDepth = 0
        this.targetScrollDepth = 0
        
        // Store previous camera mode and switch to free mode
        this.previousCameraMode = this.camera.mode
        this.camera.mode = 'free'
        console.log('[ScrollNavigator] Camera mode changed from', this.previousCameraMode, 'to free')
        
        // Set camera position
        if (options.startPosition)
        {
            console.log('[ScrollNavigator] Setting camera position to:', options.startPosition)
            gsap.to(this.camera.instance.position, {
                x: options.startPosition.x,
                y: options.startPosition.y,
                z: options.startPosition.z,
                duration: 1,
                ease: 'power2.inOut',
                onComplete: () => {
                    console.log('[ScrollNavigator] Camera animation complete. Position:', this.camera.instance.position)
                }
            })
        }
        
        console.log('[ScrollNavigator] enabled FINAL CHECK:', { 
            enabled: this.enabled, 
            startZ: this.startZ, 
            maxDepth: this.maxDepth, 
            previousMode: this.previousCameraMode 
        })
    }

    /**
     * Focus camera on a specific page
     */
    focusOnPage(pageIndex)
    {
        this.isFocusingPage = true
        this.focusedPageIndex = pageIndex
        // Don't reset positions - let the update loop detect the change
        console.log('[ScrollNavigator] Focusing on page', pageIndex)
        
        // Announce page change for accessibility
        if(this.accessibilityManager)
        {
            this.accessibilityManager.announcePage(pageIndex, `Page ${pageIndex + 1}`)
        }
    }
    
    /**
     * Return camera to center line
     */
    unfocusPage()
    {
        this.isFocusingPage = false
        this.focusedPageIndex = -1
        this.focusStartPosition = null
        this.focusTargetPosition = null
        this.focusProgress = 0
        console.log('[ScrollNavigator] Unfocusing, returning to center')
    }
    
    /**
     * Disable scroll navigation
     */
    disable()
    {
        this.enabled = false
        
        // Restore previous camera mode
        if (this.previousCameraMode)
        {
            this.camera.mode = this.previousCameraMode
            console.log('[ScrollNavigator] disabled, restored camera mode:', this.previousCameraMode)
        }
        else
        {
            console.log('[ScrollNavigator] disabled')
        }
    }

    /**
     * Set scroll depth programmatically
     * @param {number} depth - Depth value (0 to 1)
     * @param {boolean} animate - Whether to animate the transition
     */
    setDepth(depth, animate = true)
    {
        depth = Math.max(0, Math.min(1, depth))
        
        if (animate)
        {
            gsap.to(this, {
                targetScrollDepth: depth,
                duration: 1,
                ease: 'power2.inOut'
            })
        }
        else
        {
            this.scrollDepth = depth
            this.targetScrollDepth = depth
        }
    }

    /**
     * Jump to specific section (0 = first, 1 = last)
     */
    jumpToSection(sectionIndex, totalSections)
    {
        const depth = sectionIndex / (totalSections - 1)
        this.setDepth(depth, true)
    }

    /**
     * Get current depth percentage
     */
    getDepth()
    {
        return this.scrollDepth
    }

    /**
     * Reset to initial state
     */
    reset()
    {
        this.scrollDepth = 0
        this.targetScrollDepth = 0
        this.enabled = false
        
        // Return camera to initial position
        gsap.to(this.camera.instance.position, {
            x: this.initialPosition.x,
            y: this.initialPosition.y,
            z: this.initialPosition.z,
            duration: 1,
            ease: 'power2.inOut'
        })
    }
}
