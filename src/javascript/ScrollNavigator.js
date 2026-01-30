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
            console.log('[ScrollNavigator] wheel event detected! deltaY:', event.deltaY)
            
            event.preventDefault()
            
            console.log('[ScrollNavigator] wheel event processing:', event.deltaY)
            
            // Update target scroll depth
            this.targetScrollDepth += event.deltaY * this.sensitivity
            
            // Clamp between 0 and 1
            this.targetScrollDepth = Math.max(0, Math.min(1, this.targetScrollDepth))
            
            console.log('[ScrollNavigator] targetScrollDepth:', this.targetScrollDepth.toFixed(3))
            
        }, { passive: false })

        // Keyboard navigation (arrow keys)
        window.addEventListener('keydown', (event) =>
        {
            console.log('[ScrollNavigator] keydown event:', event.key)
            
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
                const spacing = 8
                const xOffset = 5
                
                const pageX = (this.focusedPageIndex % 2 === 0) ? xOffset : -xOffset
                const pageY = 3 - (this.focusedPageIndex * spacing)
                
                // Smoothly move camera toward page position
                this.camera.instance.position.x += (pageX * 0.7 - this.camera.instance.position.x) * 0.1
                this.camera.instance.position.y += (pageY - this.camera.instance.position.y) * 0.1
                this.camera.instance.position.z = 0
                
                // Face the page - only rotate around Y axis
                const targetRotationY = (pageX > 0) ? Math.PI / 6 : -Math.PI / 6
                this.camera.instance.rotation.y += (targetRotationY - this.camera.instance.rotation.y) * 0.1
                this.camera.instance.rotation.x = 0
                this.camera.instance.rotation.z = 0
            }
            else
            {
                // Camera moves freely down the center line
                this.scrollDepth += (this.targetScrollDepth - this.scrollDepth) * this.smoothness
                
                const maxPages = 8
                const maxTravel = maxPages * 8 // Total Y distance
                const targetY = 3 - (this.scrollDepth * maxTravel)
                
                // Keep camera at center X=0
                this.camera.instance.position.x += (0 - this.camera.instance.position.x) * 0.1
                this.camera.instance.position.y = targetY
                this.camera.instance.position.z = 0
                
                // Face straight down the corridor
                this.camera.instance.rotation.z += (0 - this.camera.instance.rotation.z) * 0.1
                
                const lookAtTarget = new THREE.Vector3(0, targetY - 10, 0)
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
        console.log('[ScrollNavigator] Focusing on page', pageIndex)
    }
    
    /**
     * Return camera to center line
     */
    unfocusPage()
    {
        this.isFocusingPage = false
        this.focusedPageIndex = -1
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
