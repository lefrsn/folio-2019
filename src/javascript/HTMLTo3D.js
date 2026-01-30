import * as THREE from 'three'

export default class HTMLTo3D
{
    constructor(_options)
    {
        // Options
        this.scene = _options.scene
        this.container = _options.container || new THREE.Object3D()
        this.debug = _options.debug
        
        // Properties
        this.panels = []
        
        console.log('[HTMLTo3D] initialized')
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

        // Create canvas
        const canvas = document.createElement('canvas')
        canvas.width = canvasWidth
        canvas.height = canvasHeight
        const ctx = canvas.getContext('2d')

        // Render HTML to canvas
        if (element)
        {
            this.renderDOMToCanvas(element, ctx, canvasWidth, canvasHeight)
        }
        else if (html)
        {
            this.renderHTMLToCanvas(html, ctx, canvasWidth, canvasHeight)
        }

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
            update: () => {
                texture.needsUpdate = true
            }
        }

        this.panels.push(panel)
        this.container.add(mesh)

        console.log(`[HTMLTo3D] Created 3D panel at (${position.x}, ${position.y}, ${position.z})`)

        return panel
    }

    /**
     * Render DOM element to canvas
     */
    renderDOMToCanvas(element, ctx, width, height)
    {
        // Clear canvas
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, width, height)

        // Get computed styles
        const styles = window.getComputedStyle(element)
        
        // Render background
        const bgColor = styles.backgroundColor
        if (bgColor && bgColor !== 'rgba(0, 0, 0, 0)')
        {
            ctx.fillStyle = bgColor
            ctx.fillRect(0, 0, width, height)
        }

        // Basic text rendering
        ctx.fillStyle = styles.color || '#000000'
        ctx.font = `${styles.fontSize || '16px'} ${styles.fontFamily || 'Arial'}`
        
        const text = element.textContent || element.innerText
        this.wrapText(ctx, text, 20, 40, width - 40, parseInt(styles.fontSize || '16') * 1.5)

        console.log('[HTMLTo3D] Rendered DOM element to canvas')
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
            roomDepth = 20,
            startZ = 0
        } = options

        const parser = new DOMParser()
        const doc = parser.parseFromString(html, 'text/html')
        const sections = doc.body.children

        const panels = []
        const spacing = 8 // Distance between pages along Y
        const xOffset = 5  // Horizontal offset for zigzag

        console.log(`[HTMLTo3D] Creating room: sections=${sections.length}, spacing=${spacing}, xOffset=${xOffset}`)

        for (let i = 0; i < sections.length; i++)
        {
            const section = sections[i]
            const sectionHTML = section.outerHTML

            // Alternate X position: +10, -10, +10, -10...
            const panelX = (i % 2 === 0) ? xOffset : -xOffset
            const panelY = -i * spacing
            
            // Rotate page to face center line (yaw rotation)
            const rotationY = (i % 2 === 0) ? Math.PI / 6 : -Math.PI / 6  // 30 degrees yaw toward center
            
            console.log(`[HTMLTo3D] Panel ${i} at position (${panelX}, ${panelY}, 1.5), rotation Y: ${rotationY}`)

            const panel = this.createPanel({
                html: sectionHTML,
                position: { x: panelX, y: panelY, z: 1.5 },
                size: { width: 5, height: 3.75 },
                canvasWidth: 1024,
                canvasHeight: 768,
                rotation: { x: Math.PI / 2, y: rotationY, z: 0 } // Stand upright and yaw toward center
            })

            panels.push(panel)
            panel.pageIndex = i // Store page index for click detection
        }

        console.log(`[HTMLTo3D] Created room with ${panels.length} panels in zigzag pattern`)
        
        return {
            panels,
            depth: roomDepth,
            navigate: (depth) => {
                // Helper to navigate through the room
                return currentZ + (depth * zStep)
            }
        }
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
