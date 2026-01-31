import * as THREE from 'three'
import html2canvas from 'html2canvas'

export default class HTMLTo3D
{
    constructor(_options)
    {
        // Options
        this.scene = _options.scene
        this.container = _options.container || new THREE.Object3D()
        this.debug = _options.debug
        this.sizes = _options.sizes // For responsive resolution
        
        // Properties
        this.panels = []
        this.baseCanvasWidth = 1024 // Base resolution
        this.baseCanvasHeight = 768
        this.resolutionScale = 1.0 // Adaptive scaling
        
        // Setup responsive resolution
        if(this.sizes)
        {
            this.setupResponsiveResolution()
        }
        
        console.log('[HTMLTo3D] initialized')
    }

    setupResponsiveResolution()
    {
        // Adjust canvas resolution based on viewport size
        const updateResolution = () => {
            const width = this.sizes.viewport.width
            const dpr = Math.min(window.devicePixelRatio || 1, 2) // Cap at 2x
            
            // Scale resolution based on viewport width
            if(width < 768)
            {
                this.resolutionScale = 0.5 // Mobile: lower resolution
            }
            else if(width < 1024)
            {
                this.resolutionScale = 0.75 // Tablet: medium resolution
            }
            else
            {
                this.resolutionScale = 1.0 // Desktop: full resolution
            }
            
            // Apply device pixel ratio
            this.resolutionScale *= dpr
            
            console.log('[HTMLTo3D] Resolution scale:', this.resolutionScale, 'for width:', width)
            
            // Update existing panels
            this.updatePanelResolutions()
        }
        
        updateResolution()
        this.sizes.on('resize', updateResolution)
    }

    updatePanelResolutions()
    {
        // Re-render panels at new resolution
        for(const panel of this.panels)
        {
            const newWidth = Math.floor(this.baseCanvasWidth * this.resolutionScale)
            const newHeight = Math.floor(this.baseCanvasHeight * this.resolutionScale)
            
            if(panel.canvasWidth !== newWidth || panel.canvasHeight !== newHeight)
            {
                panel.canvas.width = newWidth
                panel.canvas.height = newHeight
                panel.canvasWidth = newWidth
                panel.canvasHeight = newHeight
                
                // Re-render if we have DOM element
                if(panel.domElement)
                {
                    this.renderDOMToCanvas(panel.domElement, panel.ctx, newWidth, newHeight)
                    panel.texture.needsUpdate = true
                }
            }
        }
    }

    /**
     * Create a 3D panel from HTML content
     * @param {Object} options
     * @param {string} options.html - HTML string content
     * @param {HTMLElement} options.element - DOM element to render
     * @param {Object} options.position - {x, y, z} position in 3D space
     * @param {Object} options.size - {width, height} in world units
     * @param {number} options.canvasWidth - Canvas resolution width
     * @param {number} options.canvasHeight - Canvas resolution height
     */
    createPanel(options)
    {
        const {
            html = '',
            element = null,
            position = { x: 0, y: 0, z: 0 },
            size = { width: 4, height: 3 },
            canvasWidth = 1024,
            canvasHeight = 768,
            rotation = { x: 0, y: 0, z: 0 }
        } = options

        // Create canvas with adaptive resolution
        const finalWidth = Math.floor(canvasWidth * this.resolutionScale)
        const finalHeight = Math.floor(canvasHeight * this.resolutionScale)
        
        const canvas = document.createElement('canvas')
        canvas.width = finalWidth
        canvas.height = finalHeight
        const ctx = canvas.getContext('2d')

        // Show "Loading..." text initially
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, finalWidth, finalHeight)
        ctx.fillStyle = '#2c3e50'
        ctx.font = 'bold 36px Arial'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText('Loading content...', finalWidth / 2, finalHeight / 2)
        ctx.textAlign = 'left'
        ctx.textBaseline = 'alphabetic'

        // Create texture from canvas
        const texture = new THREE.CanvasTexture(canvas)
        texture.needsUpdate = true

        // Create geometry
        const geometry = new THREE.PlaneGeometry(size.width, size.height)

        // Create material with the texture
        const material = new THREE.MeshBasicMaterial({
            map: texture,
            side: THREE.DoubleSide,
            transparent: true
        })

        // Create mesh
        const mesh = new THREE.Mesh(geometry, material)
        mesh.position.set(position.x, position.y, position.z)
        mesh.rotation.set(rotation.x, rotation.y, rotation.z)

        // Store panel data
        const panel = {
            mesh,
            canvas,
            texture,
            ctx,
            canvasWidth: finalWidth,
            canvasHeight: finalHeight,
            domElement: element, // Keep reference to original DOM element
            htmlTo3DInstance: this, // Reference for re-rendering
            interactiveRegions: [], // Track clickable elements
            liveUpdate: false, // Enable live updating
            scrollY: 0, // Current scroll position
            maxScroll: 0, // Maximum scroll (will be calculated after rendering)
            update: () => {
                texture.needsUpdate = true
            },
            scrollTo: (scrollY) => {
                // Clamp scroll value
                panel.scrollY = Math.max(0, Math.min(scrollY, panel.maxScroll))
                
                // Re-render with scroll offset
                if(panel.domElement && panel.canvas.scrollInfo) {
                    // Update scroll info
                    panel.canvas.scrollInfo.scrollY = panel.scrollY
                    
                    // Render the visible portion
                    this.renderVisiblePortion(panel)
                }
            }
        }

        // Render HTML to canvas (async for better rendering)
        if (element)
        {
            this.renderDOMToCanvas(element, ctx, finalWidth, finalHeight)
                .then(() => {
                    texture.needsUpdate = true
                    // Update max scroll based on content height
                    if(canvas.scrollInfo) {
                        panel.maxScroll = canvas.scrollInfo.maxScroll
                        console.log('[HTMLTo3D] Panel scrollable, maxScroll:', panel.maxScroll)
                    }
                })
                .catch(() => {
                    texture.needsUpdate = true
                })
        }
        else if (html)
        {
            this.renderHTMLToCanvas(html, ctx, finalWidth, finalHeight)
        }

        this.panels.push(panel)
        this.container.add(mesh)

        console.log(`[HTMLTo3D] Created 3D panel at (${position.x}, ${position.y}, ${position.z})`)

        return panel
    }
    
    /**
     * Render the visible portion of a scrollable panel
     */
    async renderVisiblePortion(panel)
    {
        if(!panel.canvas.scrollInfo) return
        
        const { scrollY, contentHeight } = panel.canvas.scrollInfo
        const visibleHeight = 768 // Original canvas height
        
        try {
            // Create temp container for rendering
            const container = document.createElement('div')
            container.style.cssText = `
                position: fixed;
                left: -10000px;
                top: 0;
                width: ${panel.canvasWidth}px;
                background: white;
                padding: 40px 30px;
                box-sizing: border-box;
                font-family: Arial, sans-serif;
                z-index: -1;
            `
            
            const clonedElement = panel.domElement.cloneNode(true)
            this.applyFullStyling(clonedElement)
            container.appendChild(clonedElement)
            document.body.appendChild(container)
            
            await new Promise(resolve => setTimeout(resolve, 50))
            
            // Render full content
            const fullCanvas = await html2canvas(container, {
                width: panel.canvasWidth,
                height: contentHeight,
                backgroundColor: '#ffffff',
                scale: 1,
                logging: false
            })
            
            // Copy visible portion
            panel.ctx.clearRect(0, 0, panel.canvasWidth, visibleHeight)
            panel.ctx.fillStyle = '#ffffff'
            panel.ctx.fillRect(0, 0, panel.canvasWidth, visibleHeight)
            panel.ctx.drawImage(
                fullCanvas,
                0, scrollY, panel.canvasWidth, visibleHeight,
                0, 0, panel.canvasWidth, visibleHeight
            )
            panel.texture.needsUpdate = true
            
            document.body.removeChild(container)
            
        } catch (error) {
            console.warn('[HTMLTo3D] Failed to render visible portion:', error)
        }
    }

    /**
     * Extract interactive elements from HTML for click detection
     * @param {HTMLElement} element - DOM element to scan
     * @param {number} canvasWidth - Canvas width for coordinate mapping
     * @param {number} canvasHeight - Canvas height for coordinate mapping
     */
    extractInteractiveElements(element, canvasWidth, canvasHeight)
    {
        const regions = []
        
        // Find all interactive elements
        const interactiveElements = element.querySelectorAll('a, button, input, select, textarea')
        
        interactiveElements.forEach(el => {
            const rect = el.getBoundingClientRect()
            const parentRect = element.getBoundingClientRect()
            
            // Calculate relative position within the canvas
            const relativeX = rect.left - parentRect.left
            const relativeY = rect.top - parentRect.top
            
            regions.push({
                type: el.tagName.toLowerCase(),
                bounds: {
                    x: relativeX,
                    y: relativeY,
                    width: rect.width,
                    height: rect.height
                },
                element: el,
                href: el.href || null,
                text: el.textContent || el.value || ''
            })
        })
        
        console.log(`[HTMLTo3D] Found ${regions.length} interactive elements`)
        return regions
    }

    /**
     * Render DOM element to canvas with full styling using html2canvas
     */
    renderDOMToCanvas(element, ctx, width, height)
    {
        return new Promise(async (resolve, reject) => {
            try {
                // Create a temporary container that's visible for html2canvas
                const container = document.createElement('div')
                container.style.cssText = `
                    position: fixed;
                    left: -10000px;
                    top: 0;
                    width: ${width}px;
                    background: white;
                    padding: 40px 30px;
                    box-sizing: border-box;
                    font-family: Arial, sans-serif;
                    z-index: -1;
                `
                
                // Clone the element to avoid modifying the original
                const clonedElement = element.cloneNode(true)
                
                // Apply 2D view styling
                this.applyFullStyling(clonedElement)
                
                container.appendChild(clonedElement)
                document.body.appendChild(container)
                
                // Wait a moment for styles to apply
                await new Promise(resolve => setTimeout(resolve, 50))
                
                // Calculate content height
                const contentHeight = Math.max(height, container.scrollHeight)
                
                // Store scroll information
                if(!ctx.canvas.scrollInfo) {
                    ctx.canvas.scrollInfo = {
                        scrollY: 0,
                        maxScroll: Math.max(0, contentHeight - height),
                        contentHeight: contentHeight
                    }
                }
                
                // Use html2canvas to render the element
                const canvas = await html2canvas(container, {
                    width: width,
                    height: contentHeight,
                    backgroundColor: '#ffffff',
                    scale: 1,
                    logging: false,
                    useCORS: true,
                    allowTaint: true
                })
                
                // Resize target canvas if needed
                if(ctx.canvas.height !== contentHeight) {
                    ctx.canvas.height = contentHeight
                    ctx.canvas.scrollInfo.contentHeight = contentHeight
                    ctx.canvas.scrollInfo.maxScroll = Math.max(0, contentHeight - height)
                }
                
                // Clear and draw to target canvas
                ctx.fillStyle = '#ffffff'
                ctx.fillRect(0, 0, width, contentHeight)
                ctx.drawImage(canvas, 0, 0, width, contentHeight)
                
                // Clean up
                document.body.removeChild(container)
                
                console.log('[HTMLTo3D] Rendered with html2canvas, size:', width, 'x', contentHeight, 'scrollable:', ctx.canvas.scrollInfo.maxScroll > 0)
                resolve()
                
            } catch (error) {
                console.error('[HTMLTo3D] html2canvas failed:', error)
                // Fallback to basic rendering
                this.renderDOMToCanvasFallback(element, ctx, width, height)
                reject(error)
            }
        })
    }
    
    /**
     * Apply full styling to match 2D view pages
     */
    applyFullStyling(element)
    {
        // Style the main section
        if(element.tagName === 'SECTION') {
            element.style.cssText = 'margin-bottom: 40px;'
        }
        
        // Style headings
        const h2 = element.querySelector('h2')
        if(h2) {
            h2.style.cssText = 'font-size: 42px; color: #2c3e50; margin: 0 0 30px 0; font-weight: bold;'
        }
        
        const h3s = element.querySelectorAll('h3')
        h3s.forEach(h3 => {
            h3.style.cssText = 'font-size: 24px; color: #34495e; margin: 20px 0 15px 0; font-weight: bold;'
        })
        
        // Style paragraphs
        const paragraphs = element.querySelectorAll('p')
        paragraphs.forEach(p => {
            if(p.querySelector('em')) {
                p.style.cssText = 'font-size: 16px; color: #7f8c8d; margin: 0 0 15px 0;'
            } else if(p.querySelector('small')) {
                p.style.cssText = 'font-size: 14px; color: #7f8c8d; margin: 10px 0 0 0;'
            } else {
                p.style.cssText = 'font-size: 18px; line-height: 1.8; color: #34495e; margin: 0 0 20px 0;'
            }
        })
        
        // Style articles (work experience items, projects, etc.)
        const articles = element.querySelectorAll('article')
        articles.forEach(article => {
            article.style.cssText = 'margin: 0 0 30px 0; padding: 25px; background: #f8f9fa; border: 1px solid #ddd; border-radius: 8px;'
        })
        
        // Style lists
        const lists = element.querySelectorAll('ul, ol')
        lists.forEach(list => {
            list.style.cssText = 'font-size: 18px; line-height: 2; color: #34495e; margin: 10px 0; padding-left: 30px;'
        })
        
        const listItems = element.querySelectorAll('li')
        listItems.forEach(li => {
            li.style.cssText = 'margin-bottom: 10px;'
        })
        
        // Style form elements
        const forms = element.querySelectorAll('form')
        forms.forEach(form => {
            form.style.cssText = 'max-width: 600px; margin-top: 20px;'
            
            form.querySelectorAll('div').forEach(div => {
                div.style.cssText = 'margin-bottom: 20px;'
            })
            
            form.querySelectorAll('label').forEach(label => {
                label.style.cssText = 'display: block; font-size: 16px; color: #34495e; margin-bottom: 8px; font-weight: bold;'
            })
            
            form.querySelectorAll('input:not([type="submit"]), textarea').forEach(input => {
                input.style.cssText = 'width: 100%; padding: 12px; font-size: 16px; border: 1px solid #ddd; border-radius: 5px; box-sizing: border-box;'
            })
            
            form.querySelectorAll('textarea').forEach(textarea => {
                textarea.style.cssText += '; resize: vertical; min-height: 100px;'
            })
            
            form.querySelectorAll('button, input[type="submit"]').forEach(button => {
                button.style.cssText = 'padding: 15px 40px; font-size: 16px; background: #3498db; color: white; border: none; border-radius: 5px; cursor: pointer; font-weight: bold; transition: background 0.3s;'
            })
        })
    }
    
    /**
     * Fallback rendering for when SVG approach fails
     */
    renderDOMToCanvasFallback(element, ctx, width, height)
    {
        // Clear canvas
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, width, height)

        // Basic text rendering
        ctx.fillStyle = '#2c3e50'
        ctx.font = 'bold 36px Arial'
        
        const text = element.textContent || element.innerText || 'No content'
        this.wrapText(ctx, text, 30, 60, width - 60, 45)

        console.log('[HTMLTo3D] Used fallback rendering for DOM element')
    }

    /**
     * Render HTML string to canvas (basic implementation)
     */
    renderHTMLToCanvas(html, ctx, width, height)
    {
        // Clear canvas with white background
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, width, height)

        // Parse basic HTML tags (simplified parser)
        const parser = new DOMParser()
        const doc = parser.parseFromString(html, 'text/html')
        
        let y = 40
        
        // Render each element
        const elements = doc.body.children
        for (const element of elements)
        {
            const tag = element.tagName.toLowerCase()
            const text = element.textContent

            // Set styles based on tag
            switch(tag)
            {
                case 'h1':
                    ctx.font = 'bold 48px Arial'
                    ctx.fillStyle = '#2c3e50'
                    break
                case 'h2':
                    ctx.font = 'bold 36px Arial'
                    ctx.fillStyle = '#34495e'
                    break
                case 'h3':
                    ctx.font = 'bold 28px Arial'
                    ctx.fillStyle = '#34495e'
                    break
                case 'p':
                    ctx.font = '20px Arial'
                    ctx.fillStyle = '#555555'
                    break
                case 'button':
                    // Draw button
                    ctx.fillStyle = '#3498db'
                    ctx.fillRect(20, y - 30, 200, 50)
                    ctx.fillStyle = '#ffffff'
                    ctx.font = 'bold 20px Arial'
                    break
                default:
                    ctx.font = '18px Arial'
                    ctx.fillStyle = '#333333'
            }

            // Render text with wrapping
            const lineHeight = parseInt(ctx.font) * 1.5
            y = this.wrapText(ctx, text, 20, y, width - 40, lineHeight)
            y += lineHeight * 0.5 // Add spacing between elements
        }

        console.log('[HTMLTo3D] Rendered HTML to canvas')
    }

    /**
     * Helper to wrap text
     */
    wrapText(ctx, text, x, y, maxWidth, lineHeight)
    {
        const words = text.split(' ')
        let line = ''
        
        for (let n = 0; n < words.length; n++)
        {
            const testLine = line + words[n] + ' '
            const metrics = ctx.measureText(testLine)
            const testWidth = metrics.width
            
            if (testWidth > maxWidth && n > 0)
            {
                ctx.fillText(line, x, y)
                line = words[n] + ' '
                y += lineHeight
            }
            else
            {
                line = testLine
            }
        }
        ctx.fillText(line, x, y)
        
        return y + lineHeight
    }

    /**
     * Create a room from HTML content
     * Parses sections and positions them at different depths
     */
    createRoom(options)
    {
        const {
            html = '',
            sections = [],
            roomDepth = 20,
            startZ = 0
        } = options

        const panels = []
        const radius = 7 // Circle radius around starting point
        const centerY = 0 // Center of the circle at Y=0

        // If we have sections, use them directly
        let sectionElements = Array.from(sections)
        
        // If we have an HTML string and no sections, split it
        if (html && sectionElements.length === 0)
        {
            // Create temporary container to parse HTML
            const tempDiv = document.createElement('div')
            tempDiv.innerHTML = html
            sectionElements = Array.from(tempDiv.children)
        }
        
        // Fallback if no sections found
        if(sectionElements.length === 0)
        {
            console.warn('[HTMLTo3D] No sections found, creating default content')
            const tempDiv = document.createElement('div')
            tempDiv.innerHTML = '<section><h1>Welcome</h1><p>No content sections found</p></section>'
            sectionElements = Array.from(tempDiv.children)
        }

        console.log(`[HTMLTo3D] Creating room: sections=${sectionElements.length}, radius=${radius}, circular layout`)

        for (let i = 0; i < sectionElements.length; i++)
        {
            const section = sectionElements[i]

            // Position pages in a circle around the starting point
            const angle = (i / sectionElements.length) * Math.PI * 2 // Full circle
            const panelX = Math.sin(angle) * radius
            const panelY = Math.cos(angle) * radius + centerY
            
            // Rotate page to face center (inward facing)
            const rotationY = -angle // Face toward center
            
            console.log(`[HTMLTo3D] Panel ${i} at position (${panelX.toFixed(2)}, ${panelY.toFixed(2)}, 1.25), rotation Y: ${rotationY.toFixed(2)}, angle: ${(angle * 180/Math.PI).toFixed(1)}°`)

            const panel = this.createPanel({
                element: section, // Pass DOM element directly for better rendering
                position: { x: panelX, y: panelY, z: 1.25 },
                size: { width: 3.5, height: 2.5 },
                canvasWidth: 1024,
                canvasHeight: 768,
                rotation: { x: Math.PI / 2, y: rotationY, z: 0 } // Stand upright and face center
            })

            // Extract interactive elements for click detection
            panel.interactiveRegions = this.extractInteractiveElements(section, panel.canvasWidth, panel.canvasHeight)
            console.log(`[HTMLTo3D] Panel ${i} has ${panel.interactiveRegions.length} interactive regions`)

            panels.push(panel)
            panel.pageIndex = i // Store page index for click detection
            panel.circleAngle = angle // Store angle for navigation
        }

        console.log(`[HTMLTo3D] Created room with ${panels.length} panels in circular pattern`)
        
        return {
            panels,
            depth: roomDepth,
            radius: radius, // Store radius for reference
            navigate: (depth) => {
                // Helper to navigate through the room
                return currentZ + (depth * zStep)
            }
        }
    }

    /**
     * Update live panels - call this every frame to refresh DOM content
     */
    updateLivePanels()
    {
        for(const panel of this.panels)
        {
            if(panel.liveUpdate && panel.domElement)
            {
                // Re-render DOM element to canvas
                this.renderDOMToCanvas(panel.domElement, panel.ctx, panel.canvasWidth, panel.canvasHeight)
                panel.texture.needsUpdate = true
            }
        }
    }

    /**
     * Enable live updating for a specific panel
     */
    enableLiveUpdate(panel)
    {
        if(!panel.domElement)
        {
            console.warn('[HTMLTo3D] Cannot enable live update - no DOM element stored')
            return
        }
        
        panel.liveUpdate = true
        console.log('[HTMLTo3D] Live update enabled for panel')
    }

    /**
     * Dispose of resources
     */
    dispose()
    {
        for (const panel of this.panels)
        {
            panel.mesh.geometry.dispose()
            panel.mesh.material.dispose()
            panel.texture.dispose()
            this.container.remove(panel.mesh)
        }
        
        this.panels = []
        console.log('[HTMLTo3D] disposed')
    }
}
