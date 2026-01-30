import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

export default class Character
{
    constructor(_options)
    {
        // Options
        this.time = _options.time
        this.controls = _options.controls
        this.camera = _options.camera
        this.debug = _options.debug
        this.config = _options.config

        // Set up
        this.container = new THREE.Object3D()
        this.position = new THREE.Vector3()
        this.rotation = new THREE.Euler()
        
        // Movement
        this.movement = {
            speed: new THREE.Vector3(),
            velocity: new THREE.Vector3(),
            direction: new THREE.Vector3(),
            moveSpeed: 0.05,
            rotationSpeed: 0.08
        }

        // Animation
        this.animations = {
            mixer: null,
            actions: {},
            currentAction: null
        }

        // State
        this.isMoving = false
        this.facingDirection = 0 // radians

        // Debug
        if(this.debug)
        {
            this.debugFolder = this.debug.addFolder('character')
        }

        this.loadCharacter()
    }

    loadCharacter()
    {
        const loader = new GLTFLoader()
        // Using a sample Ready Player Me avatar URL - replace with your own
        const avatarUrl = 'https://models.readyplayer.me/64d6f23c-c01c-4373-8ae6-48e6b920b854.glb'

        loader.load(avatarUrl, (gltf) => {
            this.model = gltf.scene
            this.model.scale.set(1, 1, 1)
            this.model.position.set(0, 0, 0)
            this.container.add(this.model)

            // Set up animation mixer
            this.animations.mixer = new THREE.AnimationMixer(this.model)
            
            // Store animations
            gltf.animations.forEach((clip) => {
                this.animations.actions[clip.name] = this.animations.mixer.clipAction(clip)
            })

            // Play idle animation by default
            if(this.animations.actions['Idle'])
            {
                this.animations.currentAction = this.animations.actions['Idle']
                this.animations.currentAction.play()
            }

            this.setupControls()
        })
    }

    setupControls()
    {
        this.time.on('tick', () => this.update())
    }

    update()
    {
        if(!this.model) return

        // Update animation mixer
        if(this.animations.mixer)
        {
            this.animations.mixer.update(this.time.delta / 1000)
        }

        // Get movement input
        const moveDirection = new THREE.Vector3()
        let isMoving = false

        if(this.controls.actions.up)
        {
            moveDirection.y += 1
            isMoving = true
        }
        if(this.controls.actions.down)
        {
            moveDirection.y -= 1
            isMoving = true
        }
        if(this.controls.actions.left)
        {
            moveDirection.x -= 1
            isMoving = true
        }
        if(this.controls.actions.right)
        {
            moveDirection.x += 1
            isMoving = true
        }

        // Normalize direction
        if(moveDirection.length() > 0)
        {
            moveDirection.normalize()

            // Update facing direction
            this.facingDirection = Math.atan2(moveDirection.x, moveDirection.y)
            
            // Smooth rotation
            let targetRotation = this.facingDirection
            let rotDiff = targetRotation - this.container.rotation.z
            
            // Normalize angle difference to -PI to PI
            while(rotDiff > Math.PI) rotDiff -= Math.PI * 2
            while(rotDiff < -Math.PI) rotDiff += Math.PI * 2
            
            this.container.rotation.z += rotDiff * this.movement.rotationSpeed

            // Move character
            const moveAmount = moveDirection.multiplyScalar(this.movement.moveSpeed)
            this.position.add(moveAmount)
            this.container.position.copy(this.position)
        }

        // Handle animation transitions
        const shouldWalk = isMoving
        const currentAnimName = this.animations.currentAction?.getClip().name

        if(shouldWalk && currentAnimName !== 'Walk' && currentAnimName !== 'Run')
        {
            // Transition to walk
            if(this.animations.actions['Walk'])
            {
                this.playAnimation('Walk')
            }
            else if(this.animations.actions['Run'])
            {
                this.playAnimation('Run')
            }
        }
        else if(!shouldWalk && (currentAnimName === 'Walk' || currentAnimName === 'Run'))
        {
            // Transition to idle
            if(this.animations.actions['Idle'])
            {
                this.playAnimation('Idle')
            }
        }
    }

    playAnimation(name)
    {
        const newAction = this.animations.actions[name]
        
        if(newAction && this.animations.currentAction !== newAction)
        {
            if(this.animations.currentAction)
            {
                this.animations.currentAction.fadeOut(0.5)
            }
            
            newAction.reset()
            newAction.fadeIn(0.5)
            newAction.play()
            this.animations.currentAction = newAction
        }
    }
}
