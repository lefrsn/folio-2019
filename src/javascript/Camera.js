import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import gsap from 'gsap'

export default class Camera
{
    constructor(_options)
    {
        // Options
        this.time = _options.time
        this.sizes = _options.sizes
        this.renderer = _options.renderer
        this.debug = _options.debug
        this.config = _options.config

        // Set up
        this.container = new THREE.Object3D()
        this.container.matrixAutoUpdate = false

        this.target = new THREE.Vector3(0, 0, 0)
        this.targetEased = new THREE.Vector3(0, 0, 0)
        this.easing = 0.15

        // Camera mode
        this.mode = 'pov' // 'isometric' or 'pov' - START IN POV LOBBY MODE
        this.povHeight = 0.8 // Height above car center for POV
        this.povDistance = 0.2 // Distance in front of car for POV
        this.povZoom = 1 // Zoom multiplier for POV
        this.povTargetZoom = 1 // Target zoom for smooth reset
        this.povZoomEasing = 0.15 // Easing for zoom reset
        this.povLastScrollDirection = 0 // Track scroll direction for auto-reset
        this.currentRoom = 'lobby' // Track which room we're in

        // Debug
        if(this.debug)
        {
            this.debugFolder = this.debug.addFolder('camera')
            // this.debugFolder.open()
        }

        this.setAngle()
        this.setInstance()
        this.setZoom()
        this.setPan()
        this.setRotation()
        this.setKeyboardToggle()
        this.setOrbitControls()
    }

    setAngle()
    {
        // Set up
        this.angle = {}

        // Items
        this.angle.items = {
            default: new THREE.Vector3(1.135, - 1.45, 1.15),
            projects: new THREE.Vector3(0.38, - 1.4, 1.63)
        }

        // Value
        this.angle.value = new THREE.Vector3()
        this.angle.value.copy(this.angle.items.default)

        // Set method
        this.angle.set = (_name) =>
        {
            const angle = this.angle.items[_name]
            if(typeof angle !== 'undefined')
            {
                gsap.to(this.angle.value, { ...angle, duration: 2, ease: 'power1.inOut' })
            }
        }

        // Debug
        if(this.debug)
        {
            this.debugFolder.add(this, 'easing').step(0.0001).min(0).max(1).name('easing')
            this.debugFolder.add(this.angle.value, 'x').step(0.001).min(- 2).max(2).name('invertDirectionX').listen()
            this.debugFolder.add(this.angle.value, 'y').step(0.001).min(- 2).max(2).name('invertDirectionY').listen()
            this.debugFolder.add(this.angle.value, 'z').step(0.001).min(- 2).max(2).name('invertDirectionZ').listen()
        }
    }

    setInstance()
    {
        // Set up
        this.instance = new THREE.PerspectiveCamera(40, this.sizes.viewport.width / this.sizes.viewport.height, 1, 80)
        this.instance.up.set(0, 0, 1)
        this.instance.position.copy(this.angle.value)
        this.instance.lookAt(new THREE.Vector3())
        this.container.add(this.instance)

        // Store FOV settings
        this.fov = {}
        this.fov.isometric = 40
        this.fov.pov = 85
        this.fov.menu = 55
        
        // Room configurations
        this.rooms = {
            about: { position: { x: -10, y: 5, z: 15 }, lookAt: { x: 0, y: 0, z: 5 }, color: { r: 0.2, g: 0.3, b: 0.5 } },
            products: { position: { x: 10, y: 5, z: 15 }, lookAt: { x: 0, y: 0, z: 5 }, color: { r: 0.2, g: 0.5, b: 0.3 } },
            gallery: { position: { x: 0, y: 5, z: 20 }, lookAt: { x: 0, y: 0, z: 0 }, color: { r: 0.4, g: 0.2, b: 0.5 } }
        }
        this.currentRoom = 'about'

        // Resize event
        this.sizes.on('resize', () =>
        {
            this.instance.aspect = this.sizes.viewport.width / this.sizes.viewport.height
            this.instance.updateProjectionMatrix()
        })

        // Time tick
        this.time.on('tick', () =>
        {
            if(this.mode === 'isometric' && !this.orbitControls.enabled)
            {
                this.targetEased.x += (this.target.x - this.targetEased.x) * this.easing
                this.targetEased.y += (this.target.y - this.targetEased.y) * this.easing
                this.targetEased.z += (this.target.z - this.targetEased.z) * this.easing

                // Apply zoom
                this.instance.position.copy(this.targetEased).add(this.angle.value.clone().normalize().multiplyScalar(this.zoom.distance))

                // Look at target
                this.instance.lookAt(this.targetEased)

                // Apply pan
                this.instance.position.x += this.pan.value.x
                this.instance.position.y += this.pan.value.y
            }
            else if(this.mode === 'pov')
            {
                // POV mode - follow car
                if(this.car)
                {
                    const carPos = new THREE.Vector3(
                        this.car.physics.car.chassis.body.position.x,
                        this.car.physics.car.chassis.body.position.y,
                        this.car.physics.car.chassis.body.position.z
                    )
                    // Get car's forward direction
                    const carQuat = new THREE.Quaternion(
                        this.car.physics.car.chassis.body.quaternion.x,
                        this.car.physics.car.chassis.body.quaternion.y,
                        this.car.physics.car.chassis.body.quaternion.z,
                        this.car.physics.car.chassis.body.quaternion.w
                    )
                    // Forward vector for car (X-axis due to -PI/2 Z rotation)
                    const forward = new THREE.Vector3(1, 0, 0)
                    forward.applyQuaternion(carQuat)
                    
                    // Position camera above and in front of car
                    const povPos = carPos.clone()
                    povPos.z += this.povHeight
                    povPos.add(forward.clone().multiplyScalar(this.povDistance * this.povZoom))
                    this.instance.position.copy(povPos)
                    
                    // Look in car's direction with horizontal rotation only
                    const lookTarget = carPos.clone()
                    lookTarget.z += this.povHeight * 0.5
                    
                    // Apply horizontal rotation to forward direction
                    const lookDir = forward.clone()
                    const yAxis = new THREE.Vector3(0, 1, 0)
                    const rotQuat = new THREE.Quaternion()
                    rotQuat.setFromAxisAngle(yAxis, this.rotation.horizontal)
                    lookDir.applyQuaternion(rotQuat)
                    
                    lookTarget.add(lookDir.multiplyScalar(10))
                    this.instance.lookAt(lookTarget)
                }
            }
        })
    }

    setPOVMode(_enabled)
    {
        if(_enabled)
        {
            this.mode = 'pov'
            this.pan.enabled = false
            this.pan.disable()
            
            // Lock vertical rotation
            this.rotation.targetVertical = 0
            this.rotation.vertical = 0
            
            // Change to wide FOV
            this.instance.fov = this.fov.pov
            this.instance.updateProjectionMatrix()
            
            // Show menu button
            const menuUI = document.querySelector('.js-pov-menu')
            if(menuUI) menuUI.classList.add('active')
            
            // Hide bird view menu
            const birdViewMenu = document.querySelector('.js-bird-view-menu')
            if(birdViewMenu) birdViewMenu.classList.remove('active')
            
            // Hide car body but keep wheels visible
            if(this.car)
            {
                this.car.container.traverse((_child) =>
                {
                    if(_child.isMesh)
                    {
                        // Keep wheels visible, hide everything else
                        const isWheel = _child.name.toLowerCase().includes('wheel')
                        _child.visible = isWheel
                    }
                })
            }
        }
        else
        {
            this.mode = 'isometric'
            this.pan.enabled = true
            this.pan.enable()
            
            // Hide menu button
            const menuUI = document.querySelector('.js-pov-menu')
            if(menuUI) menuUI.classList.remove('active')
                        // Show bird view menu button
            const birdViewMenu = document.querySelector('.js-bird-view-menu')
            if(birdViewMenu) birdViewMenu.classList.add('active')
                        // Reset zoom
            this.povZoom = 1
            this.povTargetZoom = 1
            
            // Change back to normal FOV
            this.instance.fov = this.fov.isometric
            this.instance.updateProjectionMatrix()
            
            // Show car body again
            if(this.car)
            {
                this.car.container.traverse((_child) =>
                {
                    if(_child.isMesh)
                    {
                        _child.visible = true
                    }
                })
            }
        }
    }

    setMenuMode(_enabled)
    {
        if(_enabled)
        {
            this.mode = 'menu'
            this.pan.enabled = false
            this.pan.disable()
            
            // Wide overview FOV
            this.instance.fov = this.fov.menu
            this.instance.updateProjectionMatrix()
            
            // Show car body
            if(this.car)
            {
                this.car.container.traverse((_child) =>
                {
                    if(_child.isMesh)
                    {
                        _child.visible = true
                    }
                })
            }
            
            // Show the menu overlay
            const menuOverlay = document.querySelector('.js-menu-overlay')
            if(menuOverlay) menuOverlay.classList.add('active')
        }
        else
        {
            // Hide menu overlay
            const menuOverlay = document.querySelector('.js-menu-overlay')
            if(menuOverlay) menuOverlay.classList.remove('active')
        }
    }

    transitionToRoom(_roomName)
    {
        this.currentRoom = _roomName
        const room = this.rooms[_roomName]
        
        if(!room) return
        
        // Hide menu overlay with fade
        const menuOverlay = document.querySelector('.js-menu-overlay')
        if(menuOverlay)
        {
            menuOverlay.style.opacity = '1'
            gsap.to(menuOverlay, {
                opacity: 0,
                duration: 0.8,
                ease: 'power2.inOut',
                onComplete: () =>
                {
                    menuOverlay.classList.remove('active')
                    menuOverlay.style.opacity = '1'
                }
            })
        }
        
        // Animate camera to room position
        gsap.to(this.instance.position, {
            x: room.position.x,
            y: room.position.y,
            z: room.position.z,
            duration: 1.2,
            ease: 'power2.inOut'
        })
        
        // Animate look-at target
        const lookAtTarget = new THREE.Vector3(room.lookAt.x, room.lookAt.y, room.lookAt.z)
        gsap.to(this, {
            onUpdate: () =>
            {
                this.instance.lookAt(lookAtTarget)
            },
            duration: 1.2,
            ease: 'power2.inOut'
        })
        
        // Change scene background color based on room
        gsap.to(this.scene.background, {
            r: room.color.r,
            g: room.color.g,
            b: room.color.b,
            duration: 1.2,
            ease: 'power2.inOut'
        })
        
        // Change to isometric mode after transition
        setTimeout(() =>
        {
            this.mode = 'isometric'
            this.pan.enabled = true
            this.pan.enable()
            
            // Show bird view menu
            const birdViewMenu = document.querySelector('.js-bird-view-menu')
            if(birdViewMenu) birdViewMenu.classList.add('active')
        }, 1200)
    }

    setZoom()
    {
        // Set up
        this.zoom = {}
        this.zoom.easing = 0.1
        this.zoom.minDistance = 5
        this.zoom.amplitude = 23
        this.zoom.value = this.config.cyberTruck ? 0.3 : 0.5
        this.zoom.targetValue = this.zoom.value
        this.zoom.distance = this.zoom.minDistance + this.zoom.amplitude * this.zoom.value

        // Listen to mousewheel event
        document.addEventListener('mousewheel', (_event) =>
        {
            this.zoom.targetValue += _event.deltaY * 0.001
            this.zoom.targetValue = Math.min(Math.max(this.zoom.targetValue, 0), 1)
        }, { passive: true })

        // Touch
        this.zoom.touch = {}
        this.zoom.touch.startDistance = 0
        this.zoom.touch.startValue = 0

        this.renderer.domElement.addEventListener('touchstart', (_event) =>
        {
            if(_event.touches.length === 2)
            {
                this.zoom.touch.startDistance = Math.hypot(_event.touches[0].clientX - _event.touches[1].clientX, _event.touches[0].clientX - _event.touches[1].clientX)
                this.zoom.touch.startValue = this.zoom.targetValue
            }
        })

        this.renderer.domElement.addEventListener('touchmove', (_event) =>
        {
            if(_event.touches.length === 2)
            {
                _event.preventDefault()

                const distance = Math.hypot(_event.touches[0].clientX - _event.touches[1].clientX, _event.touches[0].clientX - _event.touches[1].clientX)
                const ratio = distance / this.zoom.touch.startDistance

                this.zoom.targetValue = this.zoom.touch.startValue - (ratio - 1)
                this.zoom.targetValue = Math.min(Math.max(this.zoom.targetValue, 0), 1)
            }
        })

        // Time tick event
        this.time.on('tick', () =>
        {
            this.zoom.value += (this.zoom.targetValue - this.zoom.value) * this.zoom.easing
            this.zoom.distance = this.zoom.minDistance + this.zoom.amplitude * this.zoom.value
        })
    }

    setPan()
    {
        // Set up
        this.pan = {}
        this.pan.enabled = false
        this.pan.active = false
        this.pan.easing = 0.1
        this.pan.start = {}
        this.pan.start.x = 0
        this.pan.start.y = 0
        this.pan.value = {}
        this.pan.value.x = 0
        this.pan.value.y = 0
        this.pan.targetValue = {}
        this.pan.targetValue.x = this.pan.value.x
        this.pan.targetValue.y = this.pan.value.y
        this.pan.raycaster = new THREE.Raycaster()
        this.pan.mouse = new THREE.Vector2()
        this.pan.needsUpdate = false
        this.pan.hitMesh = new THREE.Mesh(
            new THREE.PlaneGeometry(500, 500, 1, 1),
            new THREE.MeshBasicMaterial({ color: 0xff0000, wireframe: true, visible: false })
        )
        this.container.add(this.pan.hitMesh)

        this.pan.reset = () =>
        {
            this.pan.targetValue.x = 0
            this.pan.targetValue.y = 0
        }

        this.pan.enable = () =>
        {
            this.pan.enabled = true

            // Update cursor
            this.renderer.domElement.classList.add('has-cursor-grab')
        }

        this.pan.disable = () =>
        {
            this.pan.enabled = false

            // Update cursor
            this.renderer.domElement.classList.remove('has-cursor-grab')
        }

        this.pan.down = (_x, _y) =>
        {
            if(!this.pan.enabled)
            {
                return
            }

            // Update cursor
            this.renderer.domElement.classList.add('has-cursor-grabbing')

            // Activate
            this.pan.active = true

            // Update mouse position
            this.pan.mouse.x = (_x / this.sizes.viewport.width) * 2 - 1
            this.pan.mouse.y = - (_y / this.sizes.viewport.height) * 2 + 1

            // Get start position
            this.pan.raycaster.setFromCamera(this.pan.mouse, this.instance)

            const intersects = this.pan.raycaster.intersectObjects([this.pan.hitMesh])

            if(intersects.length)
            {
                this.pan.start.x = intersects[0].point.x
                this.pan.start.y = intersects[0].point.y
            }
        }

        this.pan.move = (_x, _y) =>
        {
            if(!this.pan.enabled)
            {
                return
            }

            if(!this.pan.active)
            {
                return
            }

            this.pan.mouse.x = (_x / this.sizes.viewport.width) * 2 - 1
            this.pan.mouse.y = - (_y / this.sizes.viewport.height) * 2 + 1

            this.pan.needsUpdate = true
        }

        this.pan.up = () =>
        {
            // Deactivate
            this.pan.active = false

            // Update cursor
            this.renderer.domElement.classList.remove('has-cursor-grabbing')
        }

        // Mouse
        window.addEventListener('mousedown', (_event) =>
        {
            if(_event.button === 2)
            {
                this.pan.down(_event.clientX, _event.clientY)
            }
        })

        window.addEventListener('mousemove', (_event) =>
        {
            this.pan.move(_event.clientX, _event.clientY)
        })

        window.addEventListener('mouseup', () =>
        {
            this.pan.up()
        })

        // Prevent context menu on right click
        window.addEventListener('contextmenu', (_event) =>
        {
            _event.preventDefault()
        })

        // Touch
        this.renderer.domElement.addEventListener('touchstart', (_event) =>
        {
            if(_event.touches.length === 1)
            {
                this.pan.down(_event.touches[0].clientX, _event.touches[0].clientY)
            }
        })

        this.renderer.domElement.addEventListener('touchmove', (_event) =>
        {
            if(_event.touches.length === 1)
            {
                this.pan.move(_event.touches[0].clientX, _event.touches[0].clientY)
            }
        })

        this.renderer.domElement.addEventListener('touchend', () =>
        {
            this.pan.up()
        })

        // Time tick event
        this.time.on('tick', () =>
        {
            // Update POV zoom with easing
            if(this.mode === 'pov')
            {
                this.povZoom += (this.povTargetZoom - this.povZoom) * this.povZoomEasing
            }
            
            // If active
            if(this.pan.active && this.pan.needsUpdate)
            {
                // Update target value
                this.pan.raycaster.setFromCamera(this.pan.mouse, this.instance)

                const intersects = this.pan.raycaster.intersectObjects([this.pan.hitMesh])

                if(intersects.length)
                {
                    this.pan.targetValue.x = - (intersects[0].point.x - this.pan.start.x)
                    this.pan.targetValue.y = - (intersects[0].point.y - this.pan.start.y)
                }

                // Update needsUpdate
                this.pan.needsUpdate = false
            }

            // Update value and apply easing
            this.pan.value.x += (this.pan.targetValue.x - this.pan.value.x) * this.pan.easing
            this.pan.value.y += (this.pan.targetValue.y - this.pan.value.y) * this.pan.easing
        })
    }

    setRotation()
    {
        // Set up
        this.rotation = {}
        this.rotation.enabled = true
        this.rotation.active = false
        this.rotation.easing = 0.08
        this.rotation.start = {}
        this.rotation.start.x = 0
        this.rotation.start.y = 0
        this.rotation.horizontal = 0
        this.rotation.vertical = 0
        this.rotation.targetHorizontal = 0
        this.rotation.targetVertical = 0
        this.rotation.sensitivityHorizontal = 0.012
        this.rotation.sensitivityVertical = 0.0015
        this.rotation.minVertical = -Math.PI * 0.3
        this.rotation.maxVertical = Math.PI * 0.3
        
        // Store initial rotations for POV reset
        this.rotation.initialHorizontal = 0
        this.rotation.initialVertical = 0

        this.rotation.down = (_x, _y) =>
        {
            if(!this.rotation.enabled)
            {
                return
            }

            this.rotation.active = true
            this.rotation.start.x = _x
            this.rotation.start.y = _y
            
            // Store initial rotation values if in POV mode
            if(this.mode === 'pov')
            {
                this.rotation.initialHorizontal = this.rotation.targetHorizontal
                this.rotation.initialVertical = this.rotation.targetVertical
            }
        }

        this.rotation.move = (_x, _y) =>
        {
            if(!this.rotation.enabled)
            {
                return
            }

            if(!this.rotation.active)
            {
                return
            }

            const deltaX = _x - this.rotation.start.x
            const deltaY = _y - this.rotation.start.y
            
            // In POV mode, only allow horizontal rotation
            if(this.mode === 'pov')
            {
                this.rotation.targetHorizontal += deltaX * this.rotation.sensitivityHorizontal
            }
            else
            {
                this.rotation.targetHorizontal += deltaX * this.rotation.sensitivityHorizontal
                this.rotation.targetVertical += deltaY * this.rotation.sensitivityVertical
                this.rotation.targetVertical = Math.max(Math.min(this.rotation.targetVertical, this.rotation.maxVertical), this.rotation.minVertical)
            }
            
            this.rotation.start.x = _x
            this.rotation.start.y = _y
        }

        this.rotation.up = () =>
        {
            // If in POV mode, return to forward-facing direction
            if(this.mode === 'pov')
            {
                this.rotation.targetHorizontal = 0
                this.rotation.targetVertical = 0
            }
            
            this.rotation.active = false
        }

        // Mouse wheel button (middle button = button 1)
        window.addEventListener('mousedown', (_event) =>
        {
            if(_event.button === 1)
            {
                this.rotation.down(_event.clientX, _event.clientY)
            }
        })

        window.addEventListener('mousemove', (_event) =>
        {
            this.rotation.move(_event.clientX, _event.clientY)
        })

        window.addEventListener('mouseup', () =>
        {
            this.rotation.up()
        })

        // Mouse wheel zoom for POV
        window.addEventListener('wheel', (_event) =>
        {
            if(this.mode === 'pov')
            {
                _event.preventDefault()
                const scrollDelta = _event.deltaY
                
                // Check if scroll direction reversed (from up to down or vice versa)
                if(this.povLastScrollDirection !== 0 && Math.sign(scrollDelta) !== Math.sign(this.povLastScrollDirection))
                {
                    // Direction reversed - start returning to 1
                    this.povTargetZoom = 1
                }
                else
                {
                    // Same direction - continue zooming
                    this.povTargetZoom += scrollDelta * 0.003
                    this.povTargetZoom = Math.max(0.3, Math.min(30, this.povTargetZoom))
                }
                
                this.povLastScrollDirection = scrollDelta
            }
        }, { passive: false })

        // Menu button click handler (from POV back to menu)
        const menuButton = document.querySelector('.js-menu-button')
        if(menuButton)
        {
            menuButton.addEventListener('click', () =>
            {
                this.setPOVMode(false)
                this.setMenuMode(true)
            })
        }

        // Bird view menu button (from isometric view back to menu)
        const birdMenuButton = document.querySelector('.js-bird-menu-button')
        if(birdMenuButton)
        {
            birdMenuButton.addEventListener('click', () =>
            {
                this.setMenuMode(true)
                
                // Animate back to menu view
                gsap.to(this.instance.position, {
                    x: 0,
                    y: 8,
                    z: 10,
                    duration: 1,
                    ease: 'power2.inOut'
                })
            })
        }

        // Close menu button (from menu to explore)
        const closeMenuButton = document.querySelector('.js-close-menu')
        if(closeMenuButton)
        {
            closeMenuButton.addEventListener('click', () =>
            {
                this.transitionToRoom('about')
            })
        }

        // Room back button (from room back to lobby)
        const roomBackButton = document.querySelector('.js-room-back-button')
        if(roomBackButton)
        {
            roomBackButton.addEventListener('click', () =>
            {
                if(this.world)
                {
                    this.world.backToLobby()
                }
            })
        }

        // Navigation tabs
        const navTabs = document.querySelectorAll('.js-nav-tab')
        const contentSections = document.querySelectorAll('.content-section')
        navTabs.forEach(tab =>
        {
            tab.addEventListener('click', (e) =>
            {
                const tabName = e.target.dataset.tab
                
                // Update active tab
                navTabs.forEach(t => t.classList.remove('active'))
                tab.classList.add('active')
                
                // Update active content
                contentSections.forEach(section => section.classList.remove('active'))
                document.querySelector(`[data-content="${tabName}"]`).classList.add('active')
                
                // Transition to room after a short delay
                setTimeout(() =>
                {
                    this.transitionToRoom(tabName)
                }, 300)
            })
        })

        // Prevent autoscroll on middle click
        window.addEventListener('auxclick', (_event) =>
        {
            if(_event.button === 1)
            {
                _event.preventDefault()
            }
        })

        // Time tick event
        this.time.on('tick', () =>
        {
            // Update values with easing
            this.rotation.horizontal += (this.rotation.targetHorizontal - this.rotation.horizontal) * this.rotation.easing
            this.rotation.vertical += (this.rotation.targetVertical - this.rotation.vertical) * this.rotation.easing

            // Only apply rotation to angle in isometric mode
            if(this.mode !== 'pov')
            {
                // Apply rotation to angle using both horizontal and vertical
                const baseDistance = Math.sqrt(1.135 * 1.135 + 1.15 * 1.15)
                const baseAngle = Math.atan2(1.15, 1.135)
                
                const horizontalAngle = baseAngle + this.rotation.horizontal
                const verticalAngle = this.rotation.vertical
                
                const horizontalRadius = baseDistance * Math.cos(verticalAngle)
                
                this.angle.value.x = horizontalRadius * Math.cos(horizontalAngle)
                this.angle.value.y = -1.45 + Math.sin(verticalAngle) * baseDistance * 0.3
                this.angle.value.z = horizontalRadius * Math.sin(horizontalAngle)
            }
        })
    }

    setKeyboardToggle()
    {
        document.addEventListener('keydown', (_event) =>
        {
            if(_event.code === 'KeyC' || _event.code === 'KeyP')
            {
                this.setPOVMode(this.mode === 'isometric')
            }
        })
    }

    setOrbitControls()
    {
        // Set up
        this.orbitControls = new OrbitControls(this.instance, this.renderer.domElement)
        this.orbitControls.enabled = false
        this.orbitControls.enableKeys = false
        this.orbitControls.zoomSpeed = 0.5

        // Debug
        if(this.debug)
        {
            this.debugFolder.add(this.orbitControls, 'enabled').name('orbitControlsEnabled')
        }
    }
}
