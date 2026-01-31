export default class ViewModeManager
{
    constructor(_options)
    {
        this.canvas = _options.canvas // 3D canvas element
        this.world = _options.world
        this.htmlTo3D = _options.htmlTo3D
        
        this.currentMode = '3d' // '3d' or '2d'
        this.toggle2DContainer = null
        
        this.createToggleButton()
        this.create2DContainer()
        
        console.log('[ViewModeManager] Initialized')
    }

    createToggleButton()
    {
        // Create toggle button
        this.toggleButton = document.createElement('button')
        this.toggleButton.textContent = 'Switch to 2D View'
        this.toggleButton.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 24px;
            font-size: 16px;
            cursor: pointer;
            background: #8e44ad;
            border: none;
            border-radius: 8px;
            font-weight: bold;
            color: white;
            z-index: 1001;
            transition: background 0.3s;
        `
        
        this.toggleButton.addEventListener('mouseenter', () => {
            this.toggleButton.style.background = '#9b59b6'
        })
        
        this.toggleButton.addEventListener('mouseleave', () => {
            this.toggleButton.style.background = '#8e44ad'
        })
        
        this.toggleButton.addEventListener('click', () => {
            this.toggleViewMode()
        })
        
        document.body.appendChild(this.toggleButton)
    }

    create2DContainer()
    {
        // Create container for 2D content
        this.toggle2DContainer = document.createElement('div')
        this.toggle2DContainer.className = 'view-2d-container'
        this.toggle2DContainer.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100vh;
            background: #ffffff;
            overflow-y: scroll;
            overflow-x: hidden;
            z-index: 999;
            display: none;
            padding: 80px 20px 40px 20px;
            box-sizing: border-box;
            -webkit-overflow-scrolling: touch;
        `
        
        // Create pages container
        this.pagesContainer = document.createElement('div')
        this.pagesContainer.style.cssText = `
            max-width: 1200px;
            margin: 0 auto;
            padding-bottom: 100px;
        `
        
        // Store current page
        this.currentPage = 'home'
        
        // Create home page
        this.createHomePage()
        
        // Create content pages
        this.createContentPages()
        
        this.toggle2DContainer.appendChild(this.pagesContainer)
        document.body.appendChild(this.toggle2DContainer)
    }
    
    createHomePage()
    {
        this.homePage = document.createElement('div')
        this.homePage.className = '2d-page-home'
        this.homePage.style.cssText = `
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            min-height: 80vh;
            text-align: center;
        `
        
        this.homePage.innerHTML = `
            <h1 style="font-size: 64px; margin: 0 0 30px 0; color: #2c3e50; font-weight: bold;">Lennart Fresen</h1>
            <p style="font-size: 24px; color: #7f8c8d; margin: 0 0 60px 0; max-width: 600px; line-height: 1.6;">Creative Developer & Designer specializing in interactive 3D web experiences</p>
            <nav style="display: flex; gap: 20px; flex-wrap: wrap; justify-content: center;">
                <button class="nav-2d-page" data-page="about" style="padding: 16px 32px; background: #3498db; color: white; border: none; border-radius: 8px; font-size: 18px; font-weight: bold; cursor: pointer; transition: all 0.3s;">About</button>
                <button class="nav-2d-page" data-page="work-experience" style="padding: 16px 32px; background: #3498db; color: white; border: none; border-radius: 8px; font-size: 18px; font-weight: bold; cursor: pointer; transition: all 0.3s;">Work Experience</button>
                <button class="nav-2d-page" data-page="projects" style="padding: 16px 32px; background: #3498db; color: white; border: none; border-radius: 8px; font-size: 18px; font-weight: bold; cursor: pointer; transition: all 0.3s;">Projects</button>
                <button class="nav-2d-page" data-page="skills" style="padding: 16px 32px; background: #3498db; color: white; border: none; border-radius: 8px; font-size: 18px; font-weight: bold; cursor: pointer; transition: all 0.3s;">Skills</button>
                <button class="nav-2d-page" data-page="contact" style="padding: 16px 32px; background: #3498db; color: white; border: none; border-radius: 8px; font-size: 18px; font-weight: bold; cursor: pointer; transition: all 0.3s;">Contact</button>
            </nav>
        `
        
        // Add hover effects to navigation buttons
        const navButtons = this.homePage.querySelectorAll('.nav-2d-page')
        navButtons.forEach(btn => {
            btn.addEventListener('mouseenter', () => {
                btn.style.background = '#2980b9'
                btn.style.transform = 'translateY(-2px)'
                btn.style.boxShadow = '0 4px 8px rgba(0,0,0,0.2)'
            })
            btn.addEventListener('mouseleave', () => {
                btn.style.background = '#3498db'
                btn.style.transform = 'translateY(0)'
                btn.style.boxShadow = 'none'
            })
            btn.addEventListener('click', () => {
                this.navigateToPage(btn.dataset.page)
            })
        })
        
        this.pagesContainer.appendChild(this.homePage)
    }
    
    createContentPages()
    {
        this.contentPages = {}
        
        const seoContent = document.querySelector('.seo-content main')
        if(!seoContent) {
            console.error('[ViewModeManager] SEO content not found')
            return
        }
        
        const sections = seoContent.querySelectorAll('section')
        sections.forEach(section => {
            const sectionId = section.id
            if(!sectionId) return
            
            const page = document.createElement('div')
            page.className = `2d-page-${sectionId}`
            page.style.cssText = 'display: none;'
            
            // Back button
            const backBtn = document.createElement('button')
            backBtn.textContent = '← Back to Home'
            backBtn.style.cssText = `
                padding: 12px 24px;
                background: #95a5a6;
                color: white;
                border: none;
                border-radius: 8px;
                font-size: 16px;
                font-weight: bold;
                cursor: pointer;
                margin-bottom: 40px;
                transition: background 0.3s;
            `
            backBtn.addEventListener('mouseenter', () => backBtn.style.background = '#7f8c8d')
            backBtn.addEventListener('mouseleave', () => backBtn.style.background = '#95a5a6')
            backBtn.addEventListener('click', () => this.navigateToPage('home'))
            
            page.appendChild(backBtn)
            
            // Clone section content
            const clonedSection = section.cloneNode(true)
            this.styleSection(clonedSection)
            page.appendChild(clonedSection)
            
            this.contentPages[sectionId] = page
            this.pagesContainer.appendChild(page)
        })
    }
    
    styleSection(section)
    {
        section.style.cssText = 'margin-bottom: 40px;'
        
        // Style headings
        const h2 = section.querySelector('h2')
        if(h2) h2.style.cssText = 'font-size: 42px; color: #2c3e50; margin-bottom: 30px; font-weight: bold;'
        
        const h3s = section.querySelectorAll('h3')
        h3s.forEach(h3 => {
            h3.style.cssText = 'font-size: 24px; color: #34495e; margin-bottom: 15px; margin-top: 30px;'
        })
        
        // Style paragraphs
        const paragraphs = section.querySelectorAll('p')
        paragraphs.forEach(p => {
            if(p.querySelector('em')) {
                p.style.cssText = 'font-size: 16px; color: #7f8c8d; margin-bottom: 15px;'
            } else if(p.querySelector('small')) {
                p.style.cssText = 'font-size: 14px; color: #7f8c8d; margin-top: 10px;'
            } else {
                p.style.cssText = 'font-size: 18px; line-height: 1.8; color: #34495e; margin-bottom: 20px;'
            }
        })
        
        // Style articles
        const articles = section.querySelectorAll('article')
        articles.forEach(article => {
            article.style.cssText = 'margin-bottom: 40px; padding: 25px; background: #f8f9fa; border: 1px solid #ddd; border-radius: 8px;'
        })
        
        // Style lists
        const lists = section.querySelectorAll('ul')
        lists.forEach(ul => {
            ul.style.cssText = 'font-size: 16px; line-height: 2; color: #34495e; list-style-position: inside; margin: 10px 0;'
        })
        
        // Style form elements
        const forms = section.querySelectorAll('form')
        forms.forEach(form => {
            form.style.cssText = 'max-width: 600px; margin-top: 20px;'
            
            form.querySelectorAll('div').forEach(div => {
                div.style.cssText = 'margin-bottom: 20px;'
            })
            
            form.querySelectorAll('label').forEach(label => {
                label.style.cssText = 'display: block; font-size: 16px; color: #34495e; margin-bottom: 8px; font-weight: bold;'
            })
            
            form.querySelectorAll('input, textarea').forEach(input => {
                input.style.cssText = 'width: 100%; padding: 12px; font-size: 16px; border: 1px solid #ddd; border-radius: 5px; box-sizing: border-box;'
            })
            
            form.querySelectorAll('textarea').forEach(textarea => {
                textarea.style.cssText += '; resize: vertical;'
            })
            
            form.querySelectorAll('button').forEach(button => {
                button.style.cssText = 'padding: 15px 40px; font-size: 16px; background: #3498db; color: white; border: none; border-radius: 5px; cursor: pointer; font-weight: bold; transition: background 0.3s;'
                button.addEventListener('mouseenter', () => button.style.background = '#2980b9')
                button.addEventListener('mouseleave', () => button.style.background = '#3498db')
            })
        })
    }
    
    navigateToPage(pageName)
    {
        console.log('[ViewModeManager] Navigating to:', pageName)
        
        // Hide all pages
        this.homePage.style.display = 'none'
        Object.values(this.contentPages).forEach(page => {
            page.style.display = 'none'
        })
        
        // Show requested page
        if(pageName === 'home') {
            this.homePage.style.display = 'flex'
        } else if(this.contentPages[pageName]) {
            this.contentPages[pageName].style.display = 'block'
        }
        
        // Reset scroll
        this.toggle2DContainer.scrollTop = 0
        
        this.currentPage = pageName
    }

    toggleViewMode()
    {
        if(this.currentMode === '3d')
        {
            this.switchTo2D()
        }
        else
        {
            this.switchTo3D()
        }
    }

    switchTo2D()
    {
        console.log('[ViewModeManager] Switching to 2D view')
        
        // Hide 3D canvas
        this.canvas.style.display = 'none'
        
        // Show 2D container
        this.toggle2DContainer.style.display = 'block'
        
        // Navigate to home page
        this.navigateToPage('home')
        
        // Ensure scrolling works by setting body overflow
        document.body.style.overflow = 'hidden'
        
        // Update button
        this.toggleButton.textContent = 'Switch to 3D View'
        
        // Pause 3D rendering if possible
        if(this.world && this.world.time)
        {
            // Could pause time here if needed
        }
        
        this.currentMode = '2d'
        console.log('[ViewModeManager] Now in 2D mode')
    }

    switchTo3D()
    {
        console.log('[ViewModeManager] Switching to 3D view')
        
        // Show 3D canvas
        this.canvas.style.display = 'block'
        
        // Hide 2D container
        this.toggle2DContainer.style.display = 'none'
        
        // Restore body overflow
        document.body.style.overflow = ''
        
        // Update button
        this.toggleButton.textContent = 'Switch to 2D View'
        
        // Resume 3D rendering if needed
        if(this.world && this.world.time)
        {
            // Could resume time here if needed
        }
        
        this.currentMode = '3d'
        console.log('[ViewModeManager] Now in 3D mode')
    }

    dispose()
    {
        if(this.toggleButton && this.toggleButton.parentElement)
        {
            this.toggleButton.parentElement.removeChild(this.toggleButton)
        }
        if(this.toggle2DContainer && this.toggle2DContainer.parentElement)
        {
            this.toggle2DContainer.parentElement.removeChild(this.toggle2DContainer)
        }
    }
}
