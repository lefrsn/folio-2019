export default class InputOverlay
{
    constructor()
    {
        this.container = null
        this.activeInput = null
        this.activePanel = null
        this.callback = null
        
        this.createOverlay()
        console.log('[InputOverlay] Initialized')
    }

    createOverlay()
    {
        // Create overlay container
        this.container = document.createElement('div')
        this.container.className = 'input-overlay'
        this.container.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(0, 0, 0, 0.9);
            border: 2px solid #4a9eff;
            border-radius: 8px;
            padding: 20px;
            z-index: 10000;
            display: none;
            min-width: 300px;
        `

        // Create input element
        const inputWrapper = document.createElement('div')
        inputWrapper.style.cssText = `
            margin-bottom: 15px;
        `

        this.input = document.createElement('input')
        this.input.type = 'text'
        this.input.style.cssText = `
            width: 100%;
            padding: 10px;
            font-size: 16px;
            border: 1px solid #4a9eff;
            border-radius: 4px;
            background: #1a1a1a;
            color: #ffffff;
            font-family: Arial, sans-serif;
        `

        inputWrapper.appendChild(this.input)

        // Create buttons
        const buttonWrapper = document.createElement('div')
        buttonWrapper.style.cssText = `
            display: flex;
            gap: 10px;
            justify-content: flex-end;
        `

        const cancelButton = document.createElement('button')
        cancelButton.textContent = 'Cancel'
        cancelButton.style.cssText = `
            padding: 8px 16px;
            border: 1px solid #666;
            border-radius: 4px;
            background: #333;
            color: #fff;
            cursor: pointer;
            font-size: 14px;
        `
        cancelButton.addEventListener('click', () => this.hide())

        const submitButton = document.createElement('button')
        submitButton.textContent = 'Submit'
        submitButton.style.cssText = `
            padding: 8px 16px;
            border: 1px solid #4a9eff;
            border-radius: 4px;
            background: #4a9eff;
            color: #fff;
            cursor: pointer;
            font-size: 14px;
        `
        submitButton.addEventListener('click', () => this.submit())

        buttonWrapper.appendChild(cancelButton)
        buttonWrapper.appendChild(submitButton)

        // Assemble overlay
        this.container.appendChild(inputWrapper)
        this.container.appendChild(buttonWrapper)
        document.body.appendChild(this.container)

        // Enter key submits
        this.input.addEventListener('keydown', (e) => {
            if(e.key === 'Enter')
            {
                this.submit()
            }
            else if(e.key === 'Escape')
            {
                this.hide()
            }
        })
    }

    show(region, panel, callback)
    {
        this.activeInput = region
        this.activePanel = panel
        this.callback = callback

        // Configure input based on element type
        const element = region.element
        if(element.tagName === 'TEXTAREA')
        {
            // Convert to textarea
            if(this.input.tagName !== 'TEXTAREA')
            {
                const textarea = document.createElement('textarea')
                textarea.style.cssText = this.input.style.cssText
                textarea.style.height = '100px'
                textarea.style.resize = 'vertical'
                this.input.parentElement.replaceChild(textarea, this.input)
                this.input = textarea
                
                // Re-add event listener
                this.input.addEventListener('keydown', (e) => {
                    if(e.key === 'Enter' && e.ctrlKey)
                    {
                        this.submit()
                    }
                    else if(e.key === 'Escape')
                    {
                        this.hide()
                    }
                })
            }
        }
        else if(element.tagName === 'SELECT')
        {
            // Handle select elements
            console.log('[InputOverlay] Select elements not yet supported')
            return
        }
        else
        {
            // Convert back to input if needed
            if(this.input.tagName === 'TEXTAREA')
            {
                const input = document.createElement('input')
                input.type = element.type || 'text'
                input.style.cssText = this.input.style.cssText
                input.style.height = 'auto'
                this.input.parentElement.replaceChild(input, this.input)
                this.input = input
                
                // Re-add event listener
                this.input.addEventListener('keydown', (e) => {
                    if(e.key === 'Enter')
                    {
                        this.submit()
                    }
                    else if(e.key === 'Escape')
                    {
                        this.hide()
                    }
                })
            }
            this.input.type = element.type || 'text'
        }

        // Set current value
        this.input.value = element.value || ''
        this.input.placeholder = element.placeholder || 'Enter value...'

        // Show overlay
        this.container.style.display = 'block'
        this.input.focus()
        this.input.select()

        console.log('[InputOverlay] Showing overlay for:', region.type)
    }

    hide()
    {
        this.container.style.display = 'none'
        this.activeInput = null
        this.activePanel = null
        this.callback = null
    }

    submit()
    {
        if(!this.activeInput || !this.activePanel)
        {
            return
        }

        const value = this.input.value

        // Update the original DOM element
        this.activeInput.element.value = value
        console.log('[InputOverlay] Updated value:', value)

        // Trigger callback if provided
        if(this.callback)
        {
            this.callback(value, this.activeInput, this.activePanel)
        }

        // Re-render the panel to show updated value
        if(this.activePanel.domElement)
        {
            const htmlTo3D = this.activePanel.htmlTo3DInstance
            if(htmlTo3D)
            {
                htmlTo3D.renderDOMToCanvas(
                    this.activePanel.domElement,
                    this.activePanel.ctx,
                    this.activePanel.canvasWidth,
                    this.activePanel.canvasHeight
                )
                this.activePanel.texture.needsUpdate = true
            }
        }

        this.hide()
    }

    dispose()
    {
        if(this.container && this.container.parentElement)
        {
            this.container.parentElement.removeChild(this.container)
        }
    }
}
