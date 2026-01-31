import * as THREE from 'three'
import * as CANNON from 'cannon'
import Materials from './Materials.js'
import ProjectBoardMaterial from '../Materials/ProjectBoard.js'
import Floor from './Floor.js'
import Shadows from './Shadows.js'
import Physics from './Physics.js'
import Zones from './Zones.js'
import Objects from './Objects.js'
import Car from './Car.js'
import Areas from './Areas.js'
import Tiles from './Tiles.js'
import Walls from './Walls.js'
import BrickWalls from './BrickWalls.js'
import Picker from './Picker.js'
import IntroSection from './Sections/IntroSection.js'
import ProjectsSection from './Sections/ProjectsSection.js'
import CrossroadsSection from './Sections/CrossroadsSection.js'
import InformationSection from './Sections/InformationSection.js'
import PlaygroundSection from './Sections/PlaygroundSection.js'
// import DistinctionASection from './Sections/DistinctionASection.js'
// import DistinctionBSection from './Sections/DistinctionBSection.js'
// import DistinctionCSection from './Sections/DistinctionCSection.js'
// import DistinctionDSection from './Sections/DistinctionDSection.js'
import Controls from './Controls.js'
import Sounds from './Sounds.js'
import gsap from 'gsap'
import EasterEggs from './EasterEggs.js'
import HTMLTo3D from '../HTMLTo3D.js'
import ScrollNavigator from '../ScrollNavigator.js'

export default class World
{
    constructor(_options)
    {
        // Options
        this.config = _options.config
        this.debug = _options.debug
        this.resources = _options.resources
        this.time = _options.time
        this.sizes = _options.sizes
        this.camera = _options.camera
        this.scene = _options.scene
        this.renderer = _options.renderer
        this.passes = _options.passes

        // Debug
        if(this.debug)
        {
            this.debugFolder = this.debug.addFolder('world')
            this.debugFolder.open()
        }

        // Set up
        this.container = new THREE.Object3D()
        this.container.matrixAutoUpdate = false

        // this.setAxes()
        this.setSounds()
        this.setControls()
        this.setFloor()
        // this.setTestCube()  // Re-enable cube
        this.setMenuBillboard()  // Add billboard
        this.setAreas()
        this.setStartingScreen()
    }

    start()
    {
        // Simplified startup sequence
        this.setReveal()
        this.setMaterials()
        this.setShadows()
        this.setPhysics()
        this.setZones()  // Keep zones for physics
        this.setAreas()  // Keep areas
        this.setObjects()
        this.setCar()
        this.areas.car = this.car  // Connect car to areas
        this.setSimpleFloor()
        this.setLights()
        this.setPicker()
        this.setScrollNavigator()
        this.setTiles()
        this.setWalls()
        this.setSections()
        this.initializeLocations()
        this.setHTMLTo3DDemo()
        
        // Container is already added to scene in Application.setWorld()
        // Just update the matrix
        this.container.updateMatrixWorld()
        
        console.log('=== WORLD START DEBUG ===')
        console.log('Scene children:', this.scene.children.length)
        console.log('Container children:', this.container.children.length)
        console.log('Camera position:', this.camera.instance.position)
        
        // Wait for resources to load before creating billboard
        this.resources.on('ready', () => {
            console.log('Resources ready - calling setMenuBillboard')
            this.setMenuBillboard()
            console.log('After setMenuBillboard:')
            console.log('  Scene children:', this.scene.children.length)
            console.log('  Container children:', this.container.children.length)
        })
        
        console.log('[World] start() complete')
    }

    setReveal()
    {
        this.reveal = {}
        this.reveal.matcapsProgress = 1.0  // Set to 1.0 so matcap materials are visible
        this.reveal.floorShadowsProgress = 1.0
        this.reveal.previousMatcapsProgress = null
        this.reveal.previousFloorShadowsProgress = null

        // Go method
        this.reveal.go = () =>
        {
            gsap.fromTo(this.reveal, { matcapsProgress: 0 }, { matcapsProgress: 1, duration: 3 })
            gsap.fromTo(this.reveal, { floorShadowsProgress: 0 }, { floorShadowsProgress: 1, duration: 3, delay: 0.5 })
            gsap.fromTo(this.shadows, { alpha: 0 }, { alpha: 0.5, duration: 3, delay: 0.5 })

            if(this.sections.intro)
            {
                gsap.fromTo(this.sections.intro.instructions.arrows.label.material, { opacity: 0 }, { opacity: 1, duration: 0.3, delay: 0.5 })
                if(this.sections.intro.otherInstructions)
                {
                    gsap.fromTo(this.sections.intro.otherInstructions.label.material, { opacity: 0 }, { opacity: 1, duration: 0.3, delay: 0.75 })
                }
            }

            // Car
            this.physics.car.chassis.body.sleep()
            this.physics.car.chassis.body.position.set(0, 0, 12)

            window.setTimeout(() =>
            {
                this.physics.car.chassis.body.wakeUp()
            }, 300)

            // Sound
            gsap.fromTo(this.sounds.engine.volume, { master: 0 }, { master: 0.7, duration: 0.5, delay: 0.3, ease: 'power2.in' })
            window.setTimeout(() =>
            {
                this.sounds.play('reveal')
            }, 400)

            // Controls
            if(this.controls.touch)
            {
                window.setTimeout(() =>
                {
                    this.controls.touch.reveal()
                }, 400)
            }
        }

        // Time tick
        this.time.on('tick',() =>
        {
            // Matcap progress changed
            if(this.reveal.matcapsProgress !== this.reveal.previousMatcapsProgress)
            {
                // Update each material
                for(const _materialKey in this.materials.shades.items)
                {
                    const material = this.materials.shades.items[_materialKey]
                    material.uniforms.uRevealProgress.value = this.reveal.matcapsProgress
                }

                // Save
                this.reveal.previousMatcapsProgress = this.reveal.matcapsProgress
            }

            // Matcap progress changed
            if(this.reveal.floorShadowsProgress !== this.reveal.previousFloorShadowsProgress)
            {
                // Update each floor shadow
                for(const _mesh of this.objects.floorShadows)
                {
                    _mesh.material.uniforms.uAlpha.value = this.reveal.floorShadowsProgress
                }

                // Save
                this.reveal.previousFloorShadowsProgress = this.reveal.floorShadowsProgress
            }

            // Check door collisions with car
            if(this.car && this.brickWalls)
            {
                this.brickWalls.checkDoorCollisions(this.car.container.position)
            }
        })

        // Debug
        if(this.debug)
        {
            this.debugFolder.add(this.reveal, 'matcapsProgress').step(0.0001).min(0).max(1).name('matcapsProgress')
            this.debugFolder.add(this.reveal, 'floorShadowsProgress').step(0.0001).min(0).max(1).name('floorShadowsProgress')
            this.debugFolder.add(this.reveal, 'go').name('reveal')
        }
    }

    setStartingScreen()
    {
        this.startingScreen = {}

        // Area
        this.startingScreen.area = this.areas.add({
            position: new THREE.Vector2(0, 0),
            halfExtents: new THREE.Vector2(2.35, 1.5),
            hasKey: false,
            testCar: false,
            active: false
        })

        // Loading label
        this.startingScreen.loadingLabel = {}
        this.startingScreen.loadingLabel.geometry = new THREE.PlaneGeometry(2.5, 2.5 / 4)
        this.startingScreen.loadingLabel.image = new Image()
        this.startingScreen.loadingLabel.image.src = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAQAAAABABAMAAAAHc7SNAAAAMFBMVEUAAAD///9ra2ucnJzR0dH09PQmJiaNjY24uLjp6end3d1CQkLFxcVYWFiqqqp9fX3nQ5qrAAAEVUlEQVRo3u3YT08TQRQA8JEtW6CATGnDdvljaTwYE2IBI/HGRrwSetGTsZh4MPFQYiQe229gE++WePFY9Oqh1cRzieEDYIgXLxjPJu5M33vbZQszW+fgoS+B7ewO836znRl2lg1jGMP4P2Okw0yFvaKsklr3I99Tvl3iPPelGbQhKqxB4eN6N/7gVcsvbEAz1F4RLn67zzl/v6/oLvejGBQ9LsNphio4UFjmEAsVJuOK/zkDtc6w+gyTcZ3LyP6IAzjBDA+pj6LkEgAjW4kANsMAC6vmOvqAMU5RgVOTskQACicCmCcA9AXjkT5gj1MswqlxWcoTgKJ6HuAQAD5guNoAu8QpMnBul1ONMGD2PCBbRgDAKYq6AEtmXvtdj3S6GhRyW1t1DvkAgM0ggG7mu1t3xWFHFzAqv3wYCi0mY1UCGgiQPU+1oWIY8LoXcAA3qeYfr+kClvHW14PJ5OfCAgHYNAoDAORBQIrDvHjqH5c0ANTbORzBacbAQgUC2IAKAzI9gCSHlWEMLmgBPJxMvyARpIICALDm4nkAbwIA71EZx5UOgO48JnLoOhQIAN9sOgKoBoAE5r0aB8ARcNhtFzrg0VQmwCp8CAMeAADGc44S5GMBsF1aCEU2LcAcAPDCvwFytBDehCaUgJxRAKeF8BNUUQJ43iiAUlqwFKoBrTCAHjiagwEgU0YM5IYWYD4KoIgPwIXQwUbVgCXzgLpIBJNeDciWTQNskVsq1ADX/6kYBdCTjse5owbMiX+IpgGWOCPSuWpA2vN/TAMm5QTYg5IC4FdbMA0YF5Nb5s2rAaLyhzBgektGZWDArrgqi0U1QHxf38OABDwUDgTAjGfyPlTVgJT/67FBACbqyGYaaoBctQwD2vI4DecVAPkgZRhQlxPQks2rAePGAbZsRlaa1QBYEQBUHRCAmaXD0QDYxgFWdye05R9cDQCrmQYkeBA6gGXTgNEeQF4DMG4S4MLjOUZRA5A0CcjADgmjqgGwSwSg9wK1GIBS74KTgTxv/EHoiaVQsTOS5RoCJuiZyosB8EIrHpyowFiYofO0i4wCjhCQwL0hq2sCaFNM22S4JXloLk0AuLDTBzCBAAt3xykeA7CHe/mDbgdTvQ9GswSAwdbqA0giYASHjQUJnhQKhQ6z/d8rDA4hAG2Dsk042ejubHMM2nV6AMf93pCkaRjhh0WsWuz+6aasl2FwiAImReEts1/CSaFfwFouAJxC4RW+I4oCThBQE1X2WbKkBFDkqYDtJ0SHaYKq3pJJwCECjjiFPoC1w+2P0gumurgeBjT6AhIIGKOelGIAngWlFnRnMZjMIYBb7gtIIsAuYU+8GICpEhYyZVgIZ2g9rYYAX1lfAKvjnxzjnWrHALDn9K1h2k2aoI1ewGd2AWAVAVMHcKdW4wDYje739pNufJXhkJohgLu9zy4CHCKAJYUge4ddCojGyPrp9kaHmYjUi9N7+2wYwxjGZfEXMKxGE0GkkfIAAAAASUVORK5CYII='
        this.startingScreen.loadingLabel.texture = new THREE.Texture(this.startingScreen.loadingLabel.image)
        this.startingScreen.loadingLabel.texture.magFilter = THREE.NearestFilter
        this.startingScreen.loadingLabel.texture.minFilter = THREE.LinearFilter
        this.startingScreen.loadingLabel.texture.needsUpdate = true
        this.startingScreen.loadingLabel.material = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, color: 0xffffff, alphaMap: this.startingScreen.loadingLabel.texture })
        this.startingScreen.loadingLabel.mesh = new THREE.Mesh(this.startingScreen.loadingLabel.geometry, this.startingScreen.loadingLabel.material)
        this.startingScreen.loadingLabel.mesh.matrixAutoUpdate = false
        // this.container.add(this.startingScreen.loadingLabel.mesh)  // Disabled - skip loading label

        // Start label
        this.startingScreen.startLabel = {}
        this.startingScreen.startLabel.geometry = new THREE.PlaneGeometry(2.5, 2.5 / 4)
        this.startingScreen.startLabel.image = new Image()
        this.startingScreen.startLabel.image.src = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAQAAAABABAMAAAAHc7SNAAAAMFBMVEUAAAD///+cnJxra2vR0dHd3d0mJib09PRYWFjp6em4uLhCQkKqqqqNjY19fX3FxcV3XeRgAAADsklEQVRo3u3YsU9TQRwH8KNgLSDQg9ZCAak1IdE4PKPu1NTEsSzOMDl3I3GpcXAxBhLjXFxNjJgQJ2ON0Rnj4uAAEyv8B/L7tV++5/VN+CM69Ldwfa+534d7d793VzeIQQzi/49c4v5lPF/1vvhFm++rjIpcyErrmrSCuz+cxng1iL/If8drPJD2Lc/Iy4VhaZWlFd4tLPfuMc6e/5LvRilJA2SkVSQA8c0OsI0uNtIAU9rsB8y1rAAZjyimAUa1mQDAeGwF+MA+9lIA69qs9AMKVoDP8vhf35A+NiMAc7YJKFSrX7tcI8BW9+k/O/kz6zSunjSnncMHiQYBcmdXrh3xCVbc2WO8N/YZZI0AxxwMArKivmwAwFKSPmV0UwBbCpj5E+C+yzUbQAaJVwUSA9SFjwFgHQ0jAMrBWgzAPCtHgFFbQAlpEwKC2zWUQgJGbAH+naSdu/fTxQAthPL5/ADD6OCpQwCAsb6LsbEGcBluOAYBmG2fkMIawHVWXEsDIGUGpZCAIRsAS93DPgDbhUmUQgKe2NUB90hfhK0YwEJYHkYpJGDbqBKiB86CGLAlzd6/S8CEvh8sACiBvrSXCshKblWEgNy2vkAMAHwGfjECcJHOu5qUQgDm6vXulshZAXJNL9GJAeg+LxeKPQBj1gzgdlnuCWAhbOi7LwaU9u0A2VWPpUgAC+GR5k0iwBtnB3Bj3qMaRYB17X0IOQhYcjYA7guxxyIAGfd1HNqchPfly7aACQUshAA2W1r5G1yG415YpgB3qIIkAHBH2D075QnQ10fHDsCl+CoGSKpiN8kMAVqIN00BsitnVgKyPIBMB4ADKU92AA5BKQIgszjKBGBLagpwB5xZBGS6pbcuizQAXMA6NAK86OCQ3okAI55BQPe7VoDxXzU/iwPASgS4GAASAiYxWgYAzvAa1loA2AkAFQIU2zEELCJtDDgIAG0CFLvp7LblC2kAtF6eTEJJ2CBAr88bAXKY4WkASbzXmwt5AvTvohHA4WSUBmj2Jt+IThQChrAOLQC13vPFMAOAQwuyTAeAKVQto3OBDOdESh2YxNZPbpYBQNbEAoBfod7e1i1BiwB0voSZWgwAOWgtAGPhD18E8ASIiRIAXNPwXJBtcqMbAFAIr5weIJMAcIx1aAAIqk0lAuycompyFwBMHAsAZlj/lgw0rsy2AkhbsgK4Q+70CUBjxeFXsUb0G1HJDJC9rketZRcCWCJwHM8DgJm7b7ch+XizXm25QQxiEOcXvwGCWOhbCZC0qAAAAABJRU5ErkJggg=='
        this.startingScreen.startLabel.texture = new THREE.Texture(this.startingScreen.startLabel.image)
        this.startingScreen.startLabel.texture.magFilter = THREE.NearestFilter
        this.startingScreen.startLabel.texture.minFilter = THREE.LinearFilter
        this.startingScreen.startLabel.texture.needsUpdate = true
        this.startingScreen.startLabel.material = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, color: 0xffffff, alphaMap: this.startingScreen.startLabel.texture })
        this.startingScreen.startLabel.material.opacity = 0
        this.startingScreen.startLabel.mesh = new THREE.Mesh(this.startingScreen.startLabel.geometry, this.startingScreen.startLabel.material)
        this.startingScreen.startLabel.mesh.matrixAutoUpdate = false
        this.container.add(this.startingScreen.startLabel.mesh)

        // Progress
        this.resources.on('progress', (_progress) =>
        {
            // Update area
            this.startingScreen.area.floorBorder.material.uniforms.uAlpha.value = 1
            this.startingScreen.area.floorBorder.material.uniforms.uLoadProgress.value = _progress
        })

        // Ready
        this.resources.on('ready', () =>
        {
            window.requestAnimationFrame(() =>
            {
                // Skip starting screen - go directly to scene
                this.start()

                window.setTimeout(() =>
                {
                    this.reveal.go()
                }, 100)
            })
        })

        // Starting screen no longer needed - auto-starting
    }

    setSounds()
    {
        this.sounds = new Sounds({
            debug: this.debugFolder,
            time: this.time
        })
    }

    setAxes()
    {
        this.axis = new THREE.AxesHelper()
        this.container.add(this.axis)
    }

    setControls()
    {
        this.controls = new Controls({
            config: this.config,
            sizes: this.sizes,
            time: this.time,
            camera: this.camera,
            sounds: this.sounds
        })
    }

    setMaterials()
    {
        this.materials = new Materials({
            resources: this.resources,
            debug: this.debugFolder
        })
    }

    setFloor()
    {
        this.floor = new Floor({
            debug: this.debugFolder
        })

        this.container.add(this.floor.container)
    }

    setTestCube()
    {
        console.log('=== Creating test cube in constructor ===')
        
        // Create cube container EXACTLY like Floor.js
        this.testCube = {}
        this.testCube.container = new THREE.Object3D()
        this.testCube.container.matrixAutoUpdate = false
        
        // Geometry and material - SMALLER cube
        this.testCube.geometry = new THREE.BoxGeometry(2, 2, 2)  // Smaller: 2x2x2
        this.testCube.material = new THREE.MeshBasicMaterial({ 
            color: 0xFF0000,
            wireframe: false
        })
        
        // Mesh - same pattern as Floor.js, at ORIGIN (0, 0, 0)
        this.testCube.mesh = new THREE.Mesh(this.testCube.geometry, this.testCube.material)
        this.testCube.mesh.frustumCulled = false
        this.testCube.mesh.matrixAutoUpdate = false
        this.testCube.mesh.position.set(0, 0, 0)  // At origin
        this.testCube.mesh.updateMatrix()
        this.testCube.container.add(this.testCube.mesh)
        
        // Add to world container - same as floor
        this.container.add(this.testCube.container)
        
        console.log('[World] Smaller cube at origin (0, 0, 0)')
    }

    setMenuBillboard()
    {
        console.log('=== Creating Lennart Fresen menu billboard ===')
        
        // Create billboard container
        this.menuBillboard = {}
        this.menuBillboard.container = new THREE.Object3D()
        this.menuBillboard.container.matrixAutoUpdate = false
        
        // Create canvas for the full menu
        const canvas = document.createElement('canvas')
        canvas.width = 1024
        canvas.height = 768
        const ctx = canvas.getContext('2d')
        
        // White background
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, 1024, 768)
        
        // Top bar with name
        ctx.fillStyle = '#2c3e50'
        ctx.fillRect(0, 0, 1024, 140)
        ctx.fillStyle = '#ffffff'
        ctx.font = 'bold 80px Arial'
        ctx.fillText('Lennart Fresen', 50, 95)
        
        // Create clickable buttons for navigation
        this.menuButtons = []
        const buttons = [
            { label: 'Home', action: 'home' },
            { label: 'Work Experience', action: 'workexperience' },
            { label: 'Certifications', action: 'certifications' },
            { label: 'Projects', action: 'projects' },
            { label: 'Contact', action: 'contact' }
        ]
        
        let buttonX = 50
        const buttonY = 200
        const buttonWidth = 180
        const buttonHeight = 70
        const buttonSpacing = 15
        
        ctx.font = 'bold 32px Arial'
        
        for (const button of buttons) {
            // Draw button background
            ctx.fillStyle = '#3498db'
            ctx.fillRect(buttonX, buttonY, buttonWidth, buttonHeight)
            
            // Draw button border
            ctx.strokeStyle = '#2980b9'
            ctx.lineWidth = 3
            ctx.strokeRect(buttonX, buttonY, buttonWidth, buttonHeight)
            
            // Draw button text
            ctx.fillStyle = '#ffffff'
            ctx.textAlign = 'center'
            ctx.textBaseline = 'middle'
            ctx.fillText(button.label, buttonX + buttonWidth / 2, buttonY + buttonHeight / 2)
            
            // Store button hitbox for click detection
            this.menuButtons.push({
                label: button.label,
                action: button.action,
                x: buttonX + buttonWidth / 2,
                y: buttonY + buttonHeight / 2,
                width: buttonWidth,
                height: buttonHeight
            })
            
            buttonX += buttonWidth + buttonSpacing
        }
        
        // Reset text alignment
        ctx.textAlign = 'left'
        ctx.textBaseline = 'alphabetic'
        
        // Content area
        ctx.fillStyle = '#000000'
        ctx.font = 'bold 56px Arial'
        ctx.fillText('Welcome to my portfolio', 50, 360)
        
        ctx.font = '40px Arial'
        ctx.fillStyle = '#555555'
        const contentLines = [
            'Full Stack Developer',
            'Specializing in web technologies',
            'Experience with React, Node.js, Three.js',
            '',
            'Click a button above to explore!'
        ]
        
        let lineY = 430
        for (const line of contentLines) {
            ctx.fillText(line, 50, lineY)
            lineY += 60
        }
        
        // Create texture from canvas
        const texture = new THREE.CanvasTexture(canvas)
        texture.needsUpdate = true
        
        // Geometry - PlaneGeometry like the original project boards
        this.menuBillboard.geometry = new THREE.PlaneGeometry(4, 3)
        
        // Material - Use ProjectBoard material like in the original project
        this.menuBillboard.material = new ProjectBoardMaterial()
        this.menuBillboard.material.uniforms.uTexture.value = texture
        this.menuBillboard.material.uniforms.uTextureAlpha.value = 1
        this.menuBillboard.material.uniforms.uColor.value = new THREE.Color('#8e7161')
        
        // Mesh - standing upright as a billboard
        this.menuBillboard.mesh = new THREE.Mesh(this.menuBillboard.geometry, this.menuBillboard.material)
        this.menuBillboard.mesh.frustumCulled = false
        this.menuBillboard.mesh.matrixAutoUpdate = false
        this.menuBillboard.mesh.position.set(10, 0, 1) // At 10, 0, 1 (lowered 2 units total)
        this.menuBillboard.mesh.rotation.y = 3 * Math.PI / 2 // 270 degrees around Y axis
        this.menuBillboard.mesh.rotation.x = Math.PI / 2 // 90 degrees around X axis
        this.menuBillboard.mesh.updateMatrix()
        this.menuBillboard.container.add(this.menuBillboard.mesh)
        
        // Add to world container
        this.container.add(this.menuBillboard.container)
        
        console.log('[World] Menu billboard at position (10, 0, 2) rotated 270deg Y, 90deg X')
    }

    setShadows()
    {
        this.shadows = new Shadows({
            time: this.time,
            debug: this.debugFolder,
            renderer: this.renderer,
            camera: this.camera
        })
        this.container.add(this.shadows.container)
    }

    setPhysics()
    {
        this.physics = new Physics({
            config: this.config,
            debug: this.debug,
            scene: this.scene,
            time: this.time,
            sizes: this.sizes,
            controls: this.controls,
            sounds: this.sounds
        })

        this.container.add(this.physics.models.container)
    }

    setZones()
    {
        this.zones = new Zones({
            time: this.time,
            physics: this.physics,
            debug: this.debugFolder
        })
        this.container.add(this.zones.container)
    }

    setLobby()
    {
        // Create lobby group (hidden for single room mode)
        this.lobby = new THREE.Group()
        this.lobby.visible = false  // Hide lobby elements in single room mode
        this.container.add(this.lobby)
        
        console.log('[World] Lobby created (hidden)')
    }

    setRoomZones()
    {
        // Create colored zone indicators for each room
        this.roomZones = new THREE.Group()
        
        // About room - Blue zone (left side)
        const aboutGeometry = new THREE.PlaneGeometry(8, 8)
        const aboutMaterial = new THREE.MeshStandardMaterial({
            color: 0x2050aa,
            metalness: 0.2,
            roughness: 0.8,
            transparent: true,
            opacity: 0.3
        })
        const aboutZone = new THREE.Mesh(aboutGeometry, aboutMaterial)
        aboutZone.rotation.x = -Math.PI * 0.5
        aboutZone.position.set(-10, 0.01, 5)
        aboutZone.userData.roomName = 'about'
        this.roomZones.add(aboutZone)
        
        // About sign
        this.createRoomSign('ABOUT', -10, 3, 5, 0x2050aa)
        
        // Products room - Green zone (right side)
        const productsGeometry = new THREE.PlaneGeometry(8, 8)
        const productsMaterial = new THREE.MeshStandardMaterial({
            color: 0x20aa50,
            metalness: 0.2,
            roughness: 0.8,
            transparent: true,
            opacity: 0.3
        })
        const productsZone = new THREE.Mesh(productsGeometry, productsMaterial)
        productsZone.rotation.x = -Math.PI * 0.5
        productsZone.position.set(10, 0.01, 5)
        productsZone.userData.roomName = 'products'
        this.roomZones.add(productsZone)
        
        // Products sign
        this.createRoomSign('PRODUCTS', 10, 3, 5, 0x20aa50)
        
        // Gallery room - Purple zone (center-back)
        const galleryGeometry = new THREE.PlaneGeometry(8, 8)
        const galleryMaterial = new THREE.MeshStandardMaterial({
            color: 0xaa20aa,
            metalness: 0.2,
            roughness: 0.8,
            transparent: true,
            opacity: 0.3
        })
        const galleryZone = new THREE.Mesh(galleryGeometry, galleryMaterial)
        galleryZone.rotation.x = -Math.PI * 0.5
        galleryZone.position.set(0, 0.01, -8)
        galleryZone.userData.roomName = 'gallery'
        this.roomZones.add(galleryZone)
        
        // Gallery sign
        this.createRoomSign('GALLERY', 0, 3, -8, 0xaa20aa)
        
        // Hide room zones initially - only visible in rooms
        this.roomZones.visible = false
        
        this.container.add(this.roomZones)
    }

    createRoomSign(_text, _x, _y, _z, _color)
    {
        // Create canvas texture for text
        const canvas = document.createElement('canvas')
        canvas.width = 512
        canvas.height = 256
        const ctx = canvas.getContext('2d')
        
        // Background
        ctx.fillStyle = `rgb(${(_color >> 16) & 255}, ${(_color >> 8) & 255}, ${_color & 255})`
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        
        // Text
        ctx.fillStyle = 'white'
        ctx.font = 'bold 80px Arial'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(_text, canvas.width / 2, canvas.height / 2)
        
        // Create texture
        const texture = new THREE.CanvasTexture(canvas)
        texture.magFilter = THREE.LinearFilter
        
        // Create sign mesh
        const signGeometry = new THREE.PlaneGeometry(4, 2)
        const signMaterial = new THREE.MeshStandardMaterial({
            map: texture,
            metalness: 0.3,
            roughness: 0.5
        })
        const sign = new THREE.Mesh(signGeometry, signMaterial)
        sign.position.set(_x, _y, _z)
        
        this.roomZones.add(sign)
    }

    enterRoom(_roomName)
    {
        // Hide lobby
        gsap.to(this.lobby, { opacity: 0, duration: 0.5 })
        
        // Show areas/room zones
        this.areas.container.visible = true
        this.roomZones.visible = true
        
        // Update camera state
        this.camera.currentRoom = _roomName
        
        // Position camera looking at the room's zone
        const roomConfig = {
            about: { position: new THREE.Vector3(0, 1, 2), lookAt: new THREE.Vector3(-10, 1, 5) },
            products: { position: new THREE.Vector3(0, 1, 2), lookAt: new THREE.Vector3(10, 1, 5) },
            gallery: { position: new THREE.Vector3(0, 1, 2), lookAt: new THREE.Vector3(0, 1, -8) }
        }
        
        const config = roomConfig[_roomName]
        if(config)
        {
            // Animate camera
            gsap.to(this.camera.instance.position, { 
                x: config.position.x, 
                y: config.position.y, 
                z: config.position.z, 
                duration: 1.2, 
                ease: 'power2.inOut' 
            })
            
            gsap.to(this.camera, { 
                target: config.lookAt, 
                duration: 1.2, 
                ease: 'power2.inOut' 
            })
        }
        
        // Show back to lobby button
        const backButton = document.querySelector('.js-room-back-button')
        if(backButton)
        {
            backButton.style.display = 'block'
            gsap.to(backButton, { opacity: 1, duration: 0.3 })
        }
    }

    backToLobby()
    {
        // Show lobby
        gsap.to(this.lobby, { opacity: 1, duration: 0.5 })
        
        // Hide areas/room zones
        this.areas.container.visible = false
        this.roomZones.visible = false
        
        // Update camera state
        this.camera.currentRoom = 'lobby'
        
        // Position camera back in lobby
        gsap.to(this.camera.instance.position, { 
            x: 0, 
            y: 1, 
            z: 3, 
            duration: 1.2, 
            ease: 'power2.inOut' 
        })
        
        // Hide back to lobby button
        const backButton = document.querySelector('.js-room-back-button')
        if(backButton)
        {
            gsap.to(backButton, { opacity: 0, duration: 0.3, onComplete: () => {
                backButton.style.display = 'none'
            }})
        }
    }

    setAreas()
    {
        this.areas = new Areas({
            config: this.config,
            resources: this.resources,
            debug: this.debug,
            renderer: this.renderer,
            camera: this.camera,
            car: this.car,
            sounds: this.sounds,
            time: this.time
        })

        this.container.add(this.areas.container)
        
        // Hide areas initially - only visible when in rooms
        this.areas.container.visible = false
    }

    setTiles()
    {
        this.tiles = new Tiles({
            resources: this.resources,
            objects: this.objects,
            debug: this.debug
        })
    }

    setWalls()
    {
        this.walls = new Walls({
            resources: this.resources,
            objects: this.objects
        })
        this.brickWalls = new BrickWalls({
            resources: this.resources,
            camera: this.camera,
            physics: this.physics
        })
    }

    setObjects()
    {
        this.objects = new Objects({
            time: this.time,
            resources: this.resources,
            materials: this.materials,
            physics: this.physics,
            shadows: this.shadows,
            sounds: this.sounds,
            debug: this.debugFolder
        })
        this.container.add(this.objects.container)

        // window.requestAnimationFrame(() =>
        // {
        //     this.objects.merge.update()
        // })
    }

    setCar()
    {
        this.car = new Car({
            time: this.time,
            resources: this.resources,
            objects: this.objects,
            physics: this.physics,
            shadows: this.shadows,
            materials: this.materials,
            controls: this.controls,
            sounds: this.sounds,
            renderer: this.renderer,
            camera: this.camera,
            debug: this.debugFolder,
            config: this.config
        })
        this.container.add(this.car.container)
        
        console.log('[World] Car added to world at position:', this.car.container.position)
        console.log('[World] Car container has', this.car.container.children.length, 'children')
        
        // Set car reference in camera for POV mode
        this.camera.car = this.car
    }

    setSections()
    {
        this.sections = {}

        // Generic options
        const options = {
            config: this.config,
            time: this.time,
            resources: this.resources,
            camera: this.camera,
            passes: this.passes,
            objects: this.objects,
            areas: this.areas,
            zones: this.zones,
            walls: this.walls,
            tiles: this.tiles,
            debug: this.debugFolder
        }

        // // Distinction A
        // this.sections.distinctionA = new DistinctionASection({
        //     ...options,
        //     x: 0,
        //     y: - 15
        // })
        // this.container.add(this.sections.distinctionA.container)

        // // Distinction B
        // this.sections.distinctionB = new DistinctionBSection({
        //     ...options,
        //     x: 0,
        //     y: - 15
        // })
        // this.container.add(this.sections.distinctionB.container)

        // // Distinction C
        // this.sections.distinctionC = new DistinctionCSection({
        //     ...options,
        //     x: 0,
        //     y: 0
        // })
        // this.container.add(this.sections.distinctionC.container)

        // // Distinction D
        // this.sections.distinctionD = new DistinctionDSection({
        //     ...options,
        //     x: 0,
        //     y: 0
        // })
        // this.container.add(this.sections.distinctionD.container)

        // Intro
        this.sections.intro = new IntroSection({
            ...options,
            x: 0,
            y: 0
        })
        this.container.add(this.sections.intro.container)

        // Crossroads
        this.sections.crossroads = new CrossroadsSection({
            ...options,
            x: 0,
            y: - 30
        })
        this.container.add(this.sections.crossroads.container)

        // Projects
        this.sections.projects = new ProjectsSection({
            ...options,
            x: 30,
            y: - 30
            // x: 0,
            // y: 0
        })
        this.container.add(this.sections.projects.container)

        // Information
        this.sections.information = new InformationSection({
            ...options,
            x: 1.2,
            y: - 55
            // x: 0,
            // y: - 10
        })
        this.container.add(this.sections.information.container)

        // Playground
        this.sections.playground = new PlaygroundSection({
            ...options,
            x: - 38,
            y: - 34
            // x: - 15,
            // y: - 4
        })
        this.container.add(this.sections.playground.container)

        // Create brick walls around each section/room
        this.setupBrickWalls()
    }

    setupBrickWalls()
    {
        // Commented out - using single room instead
        // // About/Intro room
        // this.brickWalls.setWallsAroundRoom({
        //     centerX: 0,
        //     centerY: 0,
        //     width: 25,
        //     height: 25,
        //     wallHeight: 3,
        //     doorSide: 'east',
        //     targetRoom: 'about',
        //     nextRoom: 'products'
        // })
    }

    setRoomWalls()
    {
        // Create a simple enclosed room
        const roomWidth = 30  // Wider room so walls are easier to see
        const roomHeight = 30
        const wallHeight = 10  // Taller walls so they're visible in camera view
        const wallThickness = 2  // Thicker walls so they're easier to see

        // North wall (positive Y) - Blue
        const northWallMaterial = new THREE.MeshBasicMaterial({ 
            color: 0x0000ff,
            side: THREE.DoubleSide
        })
        const northWall = new THREE.Mesh(
            new THREE.BoxGeometry(roomWidth, wallThickness, wallHeight),
            northWallMaterial
        )
        northWall.position.set(0, roomHeight / 2, wallHeight / 2)
        this.scene.add(northWall)  // Add directly to scene instead of container
        console.log('North wall (BLUE) added at:', northWall.position)

        // Add physics for north wall
        const northBody = new CANNON.Body({
            mass: 0,
            shape: new CANNON.Box(new CANNON.Vec3(roomWidth / 2, wallThickness / 2, wallHeight / 2)),
            position: new CANNON.Vec3(0, roomHeight / 2, wallHeight / 2)
        })
        this.physics.world.addBody(northBody)

        // South wall (negative Y) - Red - where the menu billboard will be
        const southWallMaterial = new THREE.MeshBasicMaterial({ 
            color: 0xff0000,
            side: THREE.DoubleSide
        })
        const southWall = new THREE.Mesh(
            new THREE.BoxGeometry(roomWidth, wallThickness, wallHeight),
            southWallMaterial
        )
        southWall.position.set(0, -roomHeight / 2, wallHeight / 2)
        this.scene.add(southWall)  // Add directly to scene instead of container
        console.log('South wall (RED) added at:', southWall.position)

        const southBody = new CANNON.Body({
            mass: 0,
            shape: new CANNON.Box(new CANNON.Vec3(roomWidth / 2, wallThickness / 2, wallHeight / 2)),
            position: new CANNON.Vec3(0, -roomHeight / 2, wallHeight / 2)
        })
        this.physics.world.addBody(southBody)

        // East wall (positive X) - Green
        const eastWallMaterial = new THREE.MeshBasicMaterial({ 
            color: 0x00ff00,
            side: THREE.DoubleSide
        })
        const eastWall = new THREE.Mesh(
            new THREE.BoxGeometry(wallThickness, roomHeight, wallHeight),
            eastWallMaterial
        )
        eastWall.position.set(roomWidth / 2, 0, wallHeight / 2)
        this.scene.add(eastWall)  // Add directly to scene instead of container
        console.log('East wall (GREEN) added at:', eastWall.position)

        const eastBody = new CANNON.Body({
            mass: 0,
            shape: new CANNON.Box(new CANNON.Vec3(wallThickness / 2, roomHeight / 2, wallHeight / 2)),
            position: new CANNON.Vec3(roomWidth / 2, 0, wallHeight / 2)
        })
        this.physics.world.addBody(eastBody)

        // West wall (negative X) - Yellow
        const westWallMaterial = new THREE.MeshBasicMaterial({ 
            color: 0xffff00,
            side: THREE.DoubleSide
        })
        const westWall = new THREE.Mesh(
            new THREE.BoxGeometry(wallThickness, roomHeight, wallHeight),
            westWallMaterial
        )
        westWall.position.set(-roomWidth / 2, 0, wallHeight / 2)
        this.scene.add(westWall)  // Add directly to scene instead of container
        console.log('West wall (YELLOW) added at:', westWall.position)

        const westBody = new CANNON.Body({
            mass: 0,
            shape: new CANNON.Box(new CANNON.Vec3(wallThickness / 2, roomHeight / 2, wallHeight / 2)),
            position: new CANNON.Vec3(-roomWidth / 2, 0, wallHeight / 2)
        })
        this.physics.world.addBody(westBody)

        console.log('[World] Room walls created: 4 walls total')
        console.log('Room dimensions:', roomWidth, 'x', roomHeight, 'height:', wallHeight)
        console.log('Car starting at (0, 0, 0) facing -Y direction')
        
        // Add wireframe helpers to ensure walls exist in scene
        const wireframeHelper = new THREE.BoxHelper(northWall, 0x00ffff)
        this.scene.add(wireframeHelper)
        const wireframeHelper2 = new THREE.BoxHelper(southWall, 0xff00ff)
        this.scene.add(wireframeHelper2)
        const wireframeHelper3 = new THREE.BoxHelper(eastWall, 0xffff00)
        this.scene.add(wireframeHelper3)
        const wireframeHelper4 = new THREE.BoxHelper(westWall, 0xff8800)
        this.scene.add(wireframeHelper4)
        
        // Count all objects in scene
        let objectCount = 0
        this.scene.traverse(() => objectCount++)
        console.log('Total objects in scene:', objectCount)

        // Floor
        const floorGeometry = new THREE.PlaneGeometry(roomWidth, roomHeight)
        const floorMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x404040,
            roughness: 0.9,
            metalness: 0.1,
            side: THREE.DoubleSide
        })
        const floor = new THREE.Mesh(floorGeometry, floorMaterial)
        floor.rotation.x = -Math.PI / 2  // Make horizontal (XY plane becomes horizontal)
        floor.position.z = 0  // At ground level
        this.container.add(floor)

        const floorBody = new CANNON.Body({
            mass: 0,
            shape: new CANNON.Plane(),
            position: new CANNON.Vec3(0, 0, 0)
        })
        this.physics.world.addBody(floorBody)

        console.log('[World] Room walls created')
    }

    setRoomLights()
    {
        // Add ambient light for overall illumination
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5)
        this.scene.add(ambientLight)

        // Add directional light from above for shadows and depth
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8)
        directionalLight.position.set(5, 5, 10)
        directionalLight.castShadow = true
        this.scene.add(directionalLight)

        // Add a point light at the center of the room
        const pointLight = new THREE.PointLight(0xffffff, 1, 30)
        pointLight.position.set(0, 0, 4)
        this.scene.add(pointLight)

        console.log('[World] Room lights created')
    }

    setEasterEggs()
    {
        this.easterEggs = new EasterEggs({
            resources: this.resources,
            car: this.car,
            walls: this.walls,
            objects: this.objects,
            materials: this.materials,
            areas: this.areas,
            config: this.config,
            physics: this.physics
        })
        this.container.add(this.easterEggs.container)
    }

    handleMenuClick(uv)
    {
        console.log('[World] handleMenuClick called with UV:', uv)
        if(!uv || !this.menuButtons) {
            console.log('[World] No UV or no menu buttons:', { uv, hasButtons: !!this.menuButtons })
            return
        }

        // Convert UV coordinates to canvas coordinates
        const canvasX = uv.x * 1024
        const canvasY = (1 - uv.y) * 768 // Flip Y coordinate

        console.log('[World] Click at canvas position:', canvasX, canvasY)

        // Check if click is on any button
        for(const button of this.menuButtons)
        {
            const left = button.x - button.width / 2
            const right = button.x + button.width / 2
            const top = button.y - button.height / 2
            const bottom = button.y + button.height / 2

            console.log('[World] Checking button:', button.label, 'bounds:', { left, right, top, bottom })

            if(canvasX >= left && canvasX <= right && canvasY >= top && canvasY <= bottom)
            {
                console.log('[World] Button clicked:', button.label, 'action:', button.action)
                this.animateButtonClick(button)
                this.onMenuButtonClick(button)
                return true
            }
        }

        console.log('[World] No button was clicked')
        return false
    }

    animateButtonClick(button)
    {
        // Create a brief flash animation on the button
        const canvas = this.menuBillboard.material.uniforms.uTexture.value.image
        const ctx = canvas.getContext('2d')
        
        // Store original button state
        const originalButtonData = ctx.getImageData(
            button.x - button.width / 2,
            button.y - button.height / 2,
            button.width,
            button.height
        )
        
        // Draw pressed state (darker button)
        ctx.fillStyle = '#2874a6' // Darker blue
        ctx.fillRect(button.x - button.width / 2, button.y - button.height / 2, button.width, button.height)
        
        // Redraw button border
        ctx.strokeStyle = '#1a5276'
        ctx.lineWidth = 3
        ctx.strokeRect(button.x - button.width / 2, button.y - button.height / 2, button.width, button.height)
        
        // Redraw button text
        ctx.fillStyle = '#ffffff'
        ctx.font = 'bold 32px Arial'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(button.label, button.x, button.y)
        
        // Update texture
        this.menuBillboard.material.uniforms.uTexture.value.needsUpdate = true
        
        // Animate back to original state using gsap
        setTimeout(() => {
            // Draw lighter hover state
            ctx.fillStyle = '#5dade2' // Lighter blue
            ctx.fillRect(button.x - button.width / 2, button.y - button.height / 2, button.width, button.height)
            
            ctx.strokeStyle = '#2980b9'
            ctx.lineWidth = 3
            ctx.strokeRect(button.x - button.width / 2, button.y - button.height / 2, button.width, button.height)
            
            ctx.fillStyle = '#ffffff'
            ctx.fillText(button.label, button.x, button.y)
            
            this.menuBillboard.material.uniforms.uTexture.value.needsUpdate = true
            
            // Return to original state
            setTimeout(() => {
                ctx.fillStyle = '#3498db' // Original blue
                ctx.fillRect(button.x - button.width / 2, button.y - button.height / 2, button.width, button.height)
                
                ctx.strokeStyle = '#2980b9'
                ctx.lineWidth = 3
                ctx.strokeRect(button.x - button.width / 2, button.y - button.height / 2, button.width, button.height)
                
                ctx.fillStyle = '#ffffff'
                ctx.fillText(button.label, button.x, button.y)
                
                this.menuBillboard.material.uniforms.uTexture.value.needsUpdate = true
            }, 150)
        }, 100)
    }

    onMenuButtonClick(button)
    {
        // Teleport to the location based on button action
        this.teleportToLocation(button.action)
        console.log(`[World] Menu button "${button.label}" clicked - teleporting to location`)
    }

    teleportToMenu()
    {
        // Teleport car to origin facing the menu
        if(this.car && this.physics)
        {
            // Update car movement
            this.car.movement.position.set(0, 0, 0)
            this.car.movement.rotation = -Math.PI / 2  // Face negative Y (toward menu)
            
            // Update car container
            this.car.container.position.set(0, 0, 0)
            this.car.container.rotation.z = -Math.PI / 2
            this.car.container.updateMatrix()
            
            // Update physics body
            if(this.physics.car && this.physics.car.chassis && this.physics.car.chassis.body)
            {
                this.physics.car.chassis.body.position.set(0, 0, 2)
                this.physics.car.chassis.body.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 0, 1), -Math.PI / 2)
                this.physics.car.chassis.body.velocity.set(0, 0, 0)
                this.physics.car.chassis.body.angularVelocity.set(0, 0, 0)
            }
            
            // Reset scroll navigator to starting position
            if(this.scrollNavigator)
            {
                this.scrollNavigator.unfocusPage()
                this.scrollNavigator.scrollDepth = 0
                this.scrollNavigator.targetScrollDepth = 0
            }
            
            // Update camera to starting position (0, 3, 0)
            if(this.camera && this.camera.instance)
            {
                this.camera.instance.position.set(0, 3, 0)
                this.camera.instance.lookAt(0, -7, 0)
                this.camera.instance.rotation.z = 0
            }
            
            // Disable scroll navigation
            if(this.scrollNavigator)
            {
                this.scrollNavigator.disable()
            }
            
            console.log('[World] Car, physics, and camera teleported to menu position (0, 0, 0)')
        }
    }

    setSimpleFloor()
    {
        // Simple floor plane - DISABLED (not needed for scroll navigator view)
        // const floorGeometry = new THREE.PlaneGeometry(100, 100)
        // const floorMaterial = new THREE.MeshBasicMaterial({ 
        //     color: 0x808080,
        //     side: THREE.DoubleSide
        // })
        // const floor = new THREE.Mesh(floorGeometry, floorMaterial)
        // floor.rotation.x = 0  // Keep horizontal (no rotation needed)
        // floor.position.z = 0
        // floor.matrixAutoUpdate = false
        // floor.updateMatrix()
        // this.container.add(floor)  // DISABLED
        
        console.log('[World] Floor DISABLED')

        // Physics floor - commented out since we don't need physics for the menu
        // const floorBody = new CANNON.Body({
        //     mass: 0,
        //     shape: new CANNON.Plane(),
        //     position: new CANNON.Vec3(0, 0, 0)
        // })
        // this.physics.world.addBody(floorBody)
        
        console.log('[World] Simple floor disabled (no physics)')
    }

    setLights()
    {
        // Ambient light
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6)
        this.scene.add(ambientLight)

        // Directional light
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8)
        directionalLight.position.set(10, 10, 20)
        directionalLight.castShadow = true
        this.scene.add(directionalLight)

        console.log('[World] Lights created')
    }

    initializeLocations()
    {
        // Define locations for each menu tab
        this.locations = {
            home: { position: new THREE.Vector3(0, 0, 1), rotation: -Math.PI / 2, label: 'Home' },
            workexperience: { position: new THREE.Vector3(-20, 0, 1), rotation: 0, label: 'Work Experience' },
            certifications: { position: new THREE.Vector3(20, 0, 1), rotation: Math.PI, label: 'Certifications' },
            projects: { position: new THREE.Vector3(10, 10, 0), rotation: Math.PI / 2, label: 'Projects' },
            contact: { position: new THREE.Vector3(0, 20, 1), rotation: Math.PI / 2, label: 'Contact' }
        }
        
        // Setup back to menu button
        const backButton = document.querySelector('.js-back-to-menu')
        if(backButton)
        {
            backButton.addEventListener('click', () => {
                this.teleportToMenu()
            })
        }
        
        // Setup page navigation buttons
        const pageButtons = document.querySelectorAll('.js-goto-page')
        pageButtons.forEach(button => {
            button.addEventListener('click', () => {
                const pageIndex = parseInt(button.dataset.page)
                if(this.scrollNavigator)
                {
                    this.scrollNavigator.focusOnPage(pageIndex)
                }
            })
        })
        
        console.log('[World] Locations initialized:', Object.keys(this.locations))
    }

    teleportToLocation(locationKey)
    {
        console.log('[World] teleportToLocation called with key:', locationKey)
        const location = this.locations[locationKey]
        if(!location) {
            console.log('[World] Location not found:', locationKey)
            return
        }

        if(this.car)
        {
            this.car.movement.position.copy(location.position)
            this.car.movement.rotation = location.rotation
            this.car.container.position.copy(location.position)
            this.car.container.rotation.z = location.rotation
            console.log(`[World] Teleported to ${location.label} at`, location.position)
        }

        // Enable scroll navigation for projects room
        console.log('[World] Checking scroll navigation:', { 
            locationKey, 
            hasScrollNavigator: !!this.scrollNavigator, 
            hasDemoRoom: !!this.demoRoom,
            demoRoomDepth: this.demoRoom?.depth 
        })
        
        if(locationKey === 'projects' && this.scrollNavigator && this.demoRoom)
        {
            console.log('[World] Enabling scroll navigation for projects room')
            this.scrollNavigator.enable({
                startZ: 10,
                maxDepth: this.demoRoom.depth,
                startPosition: {
                    x: 10,
                    y: 10,
                    z: 10
                }
            })
            console.log('[World] Scroll navigation enabled - use mouse wheel or arrow keys to explore the room!')
        }
        else if(this.scrollNavigator)
        {
            console.log('[World] Disabling scroll navigation')
            // Disable scroll navigation for other locations
            this.scrollNavigator.disable()
        }
    }

    setPicker()
    {
        this.picker = new Picker({
            sizes: this.sizes,
            camera: this.camera,
            scene: this.scene,
            physics: this.physics,
            time: this.time,
            objects: this.objects,
            world: this
        })
    }

    setScrollNavigator()
    {
        this.scrollNavigator = new ScrollNavigator({
            camera: this.camera,
            time: this.time,
            debug: this.debug
        })
        
        console.log('[World] ScrollNavigator initialized:', this.scrollNavigator)
        console.log('[World] ScrollNavigator.enabled:', this.scrollNavigator.enabled)
    }

    setHTMLTo3DDemo()
    {
        // Initialize HTMLTo3D system
        this.htmlTo3D = new HTMLTo3D({
            scene: this.scene,
            container: this.container,
            debug: this.debug
        })

        // Create a welcome page in front of the car
        const welcomeHTML = `
            <h1>Portfolio Gallery</h1>
            <h2>Featured Projects</h2>
            <p>Innovative web experiences and interactive 3D applications</p>
            <h3>Recent Work</h3>
            <p>• Interactive 3D Portfolio System</p>
            <p>• Real-time Web Graphics</p>
            <p>• Physics-based Simulations</p>
            <h3>Technologies</h3>
            <p>Three.js • WebGL • JavaScript • HTML5 Canvas</p>
            <button>View All Projects</button>
        `

        // Create welcome panel in front of car
        this.welcomePanel = this.htmlTo3D.createPanel({
            html: welcomeHTML,
            position: { x: 0, y: -6, z: 1.5 }, // In front of the car at spawn
            size: { width: 6, height: 4.5 },
            canvasWidth: 1024,
            canvasHeight: 768,
            rotation: { x: Math.PI / 2, y: 0, z: 0 } // Rotate 90 degrees around X axis to stand upright
        })

        // Create a demo room with sample HTML content
        const demoHTML = `
            <h1>Welcome to 3D Web</h1>
            <p>This is a demonstration of HTML content rendered in 3D space.</p>
            <h2>Features</h2>
            <p>Each section is positioned at a different depth in the room. Scroll forward to explore!</p>
            <h3>Interactive Content</h3>
            <p>You can render any HTML content as 3D panels in your scene.</p>
            <button>Click Me</button>
            <h2>Products Section</h2>
            <p>Imagine product cards floating and rotating in 3D space here.</p>
        `

        // Create the room at the projects location
        this.demoRoom = this.htmlTo3D.createRoom({
            html: demoHTML,
            roomDepth: 100,  // Not used anymore, spacing is in createRoom
            startZ: 0
        })

        console.log('[World] HTMLTo3D demo room created')
        console.log('  Pages placed along Y axis from Y=0 going negative')
        console.log('  Camera starts at (0, 3, 0)')
        console.log('  Scroll to navigate through pages')
        console.log('  demoRoom.depth:', this.demoRoom.depth)
        console.log('  scrollNavigator exists:', !!this.scrollNavigator)
        
        // Configure scroll navigator to move along Y axis
        if(this.scrollNavigator)
        {
            this.scrollNavigator.startZ = 3        // Camera starts at Y=3
            this.scrollNavigator.maxDepth = 100    // Can travel 100 units on Y axis
            this.scrollNavigator.panels = this.demoRoom.panels // Pass panel reference for accurate positioning
            console.log('[World] ScrollNavigator configured: startY=3, maxDepth=100, panels:', this.demoRoom.panels.length)
        }
    }
}
