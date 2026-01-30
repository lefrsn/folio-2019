import * as THREE from 'three'
import CANNON from 'cannon'
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js'

export default class Car
{
    constructor(_options)
    {
        // Options
        this.time = _options.time
        this.resources = _options.resources
        this.objects = _options.objects
        this.physics = _options.physics
        this.shadows = _options.shadows
        this.materials = _options.materials
        this.controls = _options.controls
        this.sounds = _options.sounds
        this.renderer = _options.renderer
        this.camera = _options.camera
        this.debug = _options.debug
        this.config = _options.config

        // Set up
        this.container = new THREE.Object3D()
        this.position = new THREE.Vector3()

        // Debug
        if(this.debug)
        {
            this.debugFolder = this.debug.addFolder('car')
            // this.debugFolder.open()
        }

        this.setModels()
        this.setMovement()
        this.setChassis()
        this.setCoordinateSystemVisuals()
        this.setAntena()
        this.setBackLights()
        this.setWheels()
        this.setTransformControls()
        this.setShootingBall()
        this.setKlaxon()
    }

    setCoordinateSystemVisuals()
    {
        // Create separate container for coordinate system visuals
        this.coordinateSystemContainer = new THREE.Object3D()
        this.container.add(this.coordinateSystemContainer)
        
        // No rotation for coordinate system
        const coordRotation = new THREE.Quaternion()
        coordRotation.setFromAxisAngle(new THREE.Vector3(0, 0, 1), 0)
        
        // Create axes helper to visualize car's coordinate system
        const axesHelper = new THREE.AxesHelper(2)
        this.coordinateSystemContainer.add(axesHelper)
        
        // Add text labels for axes
        const createTextLabel = (text, color) => {
            const canvas = document.createElement('canvas')
            canvas.width = 256
            canvas.height = 256
            const context = canvas.getContext('2d')
            context.fillStyle = color
            context.font = 'Bold 120px Arial'
            context.fillText(text, 30, 150)
            
            const texture = new THREE.CanvasTexture(canvas)
            const spriteMaterial = new THREE.SpriteMaterial({ map: texture })
            return new THREE.Sprite(spriteMaterial)
        }
        
        // X axis - Red (right)
        const xLabel = createTextLabel('X', '#ff0000')
        xLabel.position.set(3, 0, 0)
        xLabel.scale.set(1, 1, 1)
        this.coordinateSystemContainer.add(xLabel)
        
        // Y axis - Green (forward)
        const yLabel = createTextLabel('Y', '#00ff00')
        yLabel.position.set(0, 3, 0)
        yLabel.scale.set(1, 1, 1)
        this.coordinateSystemContainer.add(yLabel)
        
        // Z axis - Blue (up)
        const zLabel = createTextLabel('Z', '#0000ff')
        zLabel.position.set(0, 0, 3)
        zLabel.scale.set(1, 1, 1)
        this.coordinateSystemContainer.add(zLabel)
        
        // Apply no rotation
        this.coordinateSystemContainer.quaternion.copy(coordRotation)
        
        // Update coordinate system to follow car in tick
        this.time.on('tick', () => {
            this.coordinateSystemContainer.quaternion.copy(coordRotation)
        })
    }

    setModels()
    {
        this.models = {}

        // Cyber truck
        if(this.config.cyberTruck)
        {
            this.models.chassis = this.resources.items.carCyberTruckChassis
            this.models.antena = this.resources.items.carCyberTruckAntena
            this.models.backLightsBrake = this.resources.items.carCyberTruckBackLightsBrake
            this.models.backLightsReverse = this.resources.items.carCyberTruckBackLightsReverse
            this.models.wheel = this.resources.items.carCyberTruckWheel
        }

        // Default
        else
        {
            this.models.chassis = this.resources.items.carDefaultChassis
            this.models.antena = this.resources.items.carDefaultAntena
            // this.models.bunnyEarLeft = this.resources.items.carDefaultBunnyEarLeft
            // this.models.bunnyEarRight = this.resources.items.carDefaultBunnyEarRight
            this.models.backLightsBrake = this.resources.items.carDefaultBackLightsBrake
            this.models.backLightsReverse = this.resources.items.carDefaultBackLightsReverse
            this.models.wheel = this.resources.items.carDefaultWheel
        }
    }

    setMovement()
    {
        this.movement = {
            position: new THREE.Vector3(0, 0, 0),
            moveSpeed: 0.1,
            rotation: -Math.PI / 2, // Face negative Y direction (toward menu billboard)
            rotationSpeed: 0.05,
            acceleration: new THREE.Vector2(0, 0)
        }

        // Time tick - handle keyboard input
        this.time.on('tick', () =>
        {
            // Get movement input in local car coordinates
            const localMoveDirection = new THREE.Vector3()
            
            if(this.controls.actions.up)
            {
                localMoveDirection.y += 1  // Forward is local +Y
            }
            if(this.controls.actions.down)
            {
                localMoveDirection.y -= 1  // Backward is local -Y
            }
            if(this.controls.actions.right)
            {
                localMoveDirection.x += 1  // Right is local +X
            }
            if(this.controls.actions.left)
            {
                localMoveDirection.x -= 1  // Left is local -X (but also rotates, handled below)
            }

            // Move coordinate system based on input
            if(localMoveDirection.length() > 0)
            {
                localMoveDirection.normalize()
                
                // Rotate movement direction by car's rotation to get world direction
                const rotationQuaternion = new THREE.Quaternion()
                rotationQuaternion.setFromAxisAngle(new THREE.Vector3(0, 0, 1), this.movement.rotation)
                localMoveDirection.applyQuaternion(rotationQuaternion)
                
                this.movement.position.add(localMoveDirection.multiplyScalar(this.movement.moveSpeed))
            }

            // Rotate coordinate system based on A/D input (steering)
            if(this.controls.actions.left)
            {
                this.movement.rotation += this.movement.rotationSpeed  // A rotates counterclockwise
            }
            if(this.controls.actions.right)
            {
                this.movement.rotation -= this.movement.rotationSpeed  // D rotates clockwise
            }

            // Update container position and rotation
            this.container.position.copy(this.movement.position)
            this.container.rotation.z = this.movement.rotation
            
            this.position.copy(this.container.position)
        })
    }

    setChassis()
    {
        this.chassis = {}
        this.chassis.offset = new THREE.Vector3(0, 0, 0.1)  // Closer to floor at z=0
        this.chassis.object = this.objects.getConvertedMesh(this.models.chassis.scene.children)
        this.chassis.object.position.copy(this.chassis.offset)
        
        // Rotate model 90 degrees around Z axis
        this.chassis.modelRotation = new THREE.Quaternion()
        this.chassis.modelRotation.setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI * 0.5)
        this.chassis.object.quaternion.copy(this.chassis.modelRotation)
        
        this.container.add(this.chassis.object)

        console.log('✓ Car chassis added to container')

        this.shadows.add(this.chassis.object, { sizeX: 3, sizeY: 2, offsetZ: 0.2 })

        // Time tick - keep chassis in same position relative to coordinate system
        this.time.on('tick', () =>
        {
            this.chassis.object.position.copy(this.chassis.offset)
            this.chassis.object.quaternion.copy(this.chassis.modelRotation)
        })
    }

    setAntena()
    {
        this.antena = {}

        this.antena.speedStrength = 10
        this.antena.damping = 0.035
        this.antena.pullBackStrength = 0.02

        this.antena.object = this.objects.getConvertedMesh(this.models.antena.scene.children)
        this.chassis.object.add(this.antena.object)

        // this.antena.bunnyEarLeft = this.objects.getConvertedMesh(this.models.bunnyEarLeft.scene.children)
        // this.chassis.object.add(this.antena.bunnyEarLeft)

        // this.antena.bunnyEarRight = this.objects.getConvertedMesh(this.models.bunnyEarRight.scene.children)
        // this.chassis.object.add(this.antena.bunnyEarRight)

        this.antena.speed = new THREE.Vector2()
        this.antena.absolutePosition = new THREE.Vector2()
        this.antena.localPosition = new THREE.Vector2()

        // Time tick
        this.time.on('tick', () =>
        {
            const max = 1
            const accelerationX = Math.min(Math.max(this.movement.acceleration.x, - max), max)
            const accelerationY = Math.min(Math.max(this.movement.acceleration.y, - max), max)

            this.antena.speed.x -= accelerationX * this.antena.speedStrength
            this.antena.speed.y -= accelerationY * this.antena.speedStrength

            const position = this.antena.absolutePosition.clone()
            const pullBack = position.negate().multiplyScalar(position.length() * this.antena.pullBackStrength)
            this.antena.speed.add(pullBack)

            this.antena.speed.x *= 1 - this.antena.damping
            this.antena.speed.y *= 1 - this.antena.damping

            this.antena.absolutePosition.add(this.antena.speed)

            this.antena.localPosition.copy(this.antena.absolutePosition)
            this.antena.localPosition.rotateAround(new THREE.Vector2(), - this.chassis.object.rotation.z)

            this.antena.object.rotation.y = this.antena.localPosition.x * 0.1
            this.antena.object.rotation.x = this.antena.localPosition.y * 0.1

            // this.antena.bunnyEarLeft.rotation.y = this.antena.localPosition.x * 0.1
            // this.antena.bunnyEarLeft.rotation.x = this.antena.localPosition.y * 0.1

            // this.antena.bunnyEarRight.rotation.y = this.antena.localPosition.x * 0.1
            // this.antena.bunnyEarRight.rotation.x = this.antena.localPosition.y * 0.1
        })

        // Debug
        if(this.debug)
        {
            const folder = this.debugFolder.addFolder('antena')
            folder.open()

            folder.add(this.antena, 'speedStrength').step(0.001).min(0).max(50)
            folder.add(this.antena, 'damping').step(0.0001).min(0).max(0.1)
            folder.add(this.antena, 'pullBackStrength').step(0.0001).min(0).max(0.1)
        }
    }

    setBackLights()
    {
        this.backLightsBrake = {}

        this.backLightsBrake.material = this.materials.pures.items.red.clone()
        this.backLightsBrake.material.transparent = true
        this.backLightsBrake.material.opacity = 0.5

        this.backLightsBrake.object = this.objects.getConvertedMesh(this.models.backLightsBrake.scene.children)
        for(const _child of this.backLightsBrake.object.children)
        {
            _child.material = this.backLightsBrake.material
        }

        this.chassis.object.add(this.backLightsBrake.object)

        // Back lights brake
        this.backLightsReverse = {}

        this.backLightsReverse.material = this.materials.pures.items.yellow.clone()
        this.backLightsReverse.material.transparent = true
        this.backLightsReverse.material.opacity = 0.5

        this.backLightsReverse.object = this.objects.getConvertedMesh(this.models.backLightsReverse.scene.children)
        for(const _child of this.backLightsReverse.object.children)
        {
            _child.material = this.backLightsReverse.material
        }

        this.chassis.object.add(this.backLightsReverse.object)

        // Time tick
        this.time.on('tick', () =>
        {
            this.backLightsBrake.material.opacity = this.physics.controls.actions.brake ? 1 : 0.5
            this.backLightsReverse.material.opacity = this.physics.controls.actions.down ? 1 : 0.5
        })
    }

    setWheels()
    {
        this.wheels = {}
        this.wheels.object = this.objects.getConvertedMesh(this.models.wheel.scene.children)
        this.wheels.items = []

        for(let i = 0; i < 4; i++)
        {
            const object = this.wheels.object.clone()
            this.wheels.items.push(object)
            this.container.add(object)
        }

        // Set wheel positions relative to chassis
        const wheelPositions = [
            new THREE.Vector3(-0.8, 1, 0),    // Front left
            new THREE.Vector3(0.8, 1, 0),    // Front right
            new THREE.Vector3(-0.8, -1, 0),   // Back left
            new THREE.Vector3(0.8, -1, 0)     // Back right
        ]

        // Time tick - position wheels around chassis
        this.time.on('tick', () =>
        {
            this.wheels.items.forEach((wheel, index) =>
            {
                wheel.position.copy(wheelPositions[index])
                wheel.quaternion.identity()
            })
        })
    }

    setTransformControls()
    {
        this.transformControls = new TransformControls(this.camera.instance, this.renderer.domElement)
        this.transformControls.size = 0.5
        this.transformControls.attach(this.chassis.object)
        this.transformControls.enabled = false
        this.transformControls.visible = this.transformControls.enabled

        document.addEventListener('keydown', (_event) =>
        {
            if(this.mode === 'transformControls')
            {
                if(_event.key === 'r')
                {
                    this.transformControls.setMode('rotate')
                }
                else if(_event.key === 'g')
                {
                    this.transformControls.setMode('translate')
                }
            }
        })

        this.transformControls.addEventListener('dragging-changed', (_event) =>
        {
            this.camera.orbitControls.enabled = !_event.value
        })

        this.container.add(this.transformControls)

        if(this.debug)
        {
            const folder = this.debugFolder.addFolder('controls')
            folder.open()

            folder.add(this.transformControls, 'enabled').onChange(() =>
            {
                this.transformControls.visible = this.transformControls.enabled
            })
        }
    }

    setShootingBall()
    {
        if(!this.config.cyberTruck)
        {
            return
        }

        window.addEventListener('keydown', (_event) =>
        {
            if(_event.key === 'b')
            {
                const angle = Math.random() * Math.PI * 2
                const distance = 10
                const x = this.position.x + Math.cos(angle) * distance
                const y = this.position.y + Math.sin(angle) * distance
                const z = 2 + 2 * Math.random()
                const bowlingBall = this.objects.add({
                    base: this.resources.items.bowlingBallBase.scene,
                    collision: this.resources.items.bowlingBallCollision.scene,
                    offset: new THREE.Vector3(x, y, z),
                    rotation: new THREE.Euler(Math.PI * 0.5, 0, 0),
                    duplicated: true,
                    shadow: { sizeX: 1.5, sizeY: 1.5, offsetZ: - 0.15, alpha: 0.35 },
                    mass: 5,
                    soundName: 'bowlingBall',
                    sleep: false
                })

                const carPosition = new CANNON.Vec3(this.position.x, this.position.y, this.position.z + 1)
                let direction = carPosition.vsub(bowlingBall.collision.body.position)
                direction.normalize()
                direction = direction.scale(100)
                bowlingBall.collision.body.applyImpulse(direction, bowlingBall.collision.body.position)
            }
        })
    }

    setKlaxon()
    {
        this.klaxon = {}
        this.klaxon.lastTime = this.time.elapsed

        window.addEventListener('keydown', (_event) =>
        {
            // Play horn sound
            if(_event.code === 'KeyH')
            {
                if(this.time.elapsed - this.klaxon.lastTime > 400)
                {
                    this.physics.car.jump(false, 150)
                    this.klaxon.lastTime = this.time.elapsed
                }

                this.sounds.play(Math.random() < 0.002 ? 'carHorn2' : 'carHorn1')
            }

            // Rain horns
            if(_event.key === 'k')
            {
                const x = this.position.x + (Math.random() - 0.5) * 3
                const y = this.position.y + (Math.random() - 0.5) * 3
                const z = 6 + 2 * Math.random()

                this.objects.add({
                    base: this.resources.items.hornBase.scene,
                    collision: this.resources.items.hornCollision.scene,
                    offset: new THREE.Vector3(x, y, z),
                    rotation: new THREE.Euler(Math.random() * Math.PI * 2, Math.random() * Math.PI * 2, Math.random() * Math.PI * 2),
                    duplicated: true,
                    shadow: { sizeX: 1.5, sizeY: 1.5, offsetZ: - 0.15, alpha: 0.35 },
                    mass: 5,
                    soundName: 'horn',
                    sleep: false
                })
            }
        })
    }

    teleportTo(_position)
    {
        // Teleport the car to a specific position
        this.position.copy(_position)
        this.container.position.copy(this.position)
        this.container.updateMatrix()

        // Update physics body position
        if(this.physics && this.physics.car && this.physics.car.chassis && this.physics.car.chassis.body)
        {
            this.physics.car.chassis.body.position.x = _position.x
            this.physics.car.chassis.body.position.y = _position.y
            this.physics.car.chassis.body.position.z = _position.z
            this.physics.car.chassis.body.velocity.x = 0
            this.physics.car.chassis.body.velocity.y = 0
            this.physics.car.chassis.body.velocity.z = 0
        }
    }}