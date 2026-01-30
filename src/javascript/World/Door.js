import * as THREE from 'three'
import EventEmitter from '../Utils/EventEmitter.js'

export default class Door extends EventEmitter
{
    constructor(_options)
    {
        super()

        // Options
        this.resources = _options.resources
        this.position = _options.position
        this.rotation = _options.rotation || new THREE.Euler()
        this.width = _options.width || 2
        this.height = _options.height || 2.5
        this.targetRoom = _options.targetRoom
        this.camera = _options.camera

        // Set up
        this.container = new THREE.Object3D()
        this.container.position.copy(this.position)
        this.container.rotation.copy(this.rotation)
        this.container.matrixAutoUpdate = false
        this.container.updateMatrix()

        this.setDoorFrame()
        this.setCollisionZone()
        this.setInteraction()
    }

    setDoorFrame()
    {
        // Door frame group
        this.frame = new THREE.Object3D()
        
        // Door frame geometry (simple box showing the entrance)
        const frameGeometry = new THREE.BoxGeometry(this.width, this.height, 0.2)
        const frameMaterial = new THREE.MeshBasicMaterial({ 
            color: 0x8B4513, 
            wireframe: false,
            transparent: true,
            opacity: 0.3
        })
        
        this.frameMesh = new THREE.Mesh(frameGeometry, frameMaterial)
        this.frameMesh.position.z = -0.1
        this.frame.add(this.frameMesh)
        
        this.container.add(this.frame)
    }

    setCollisionZone()
    {
        // Create a larger collision zone for door detection
        const zoneGeometry = new THREE.BoxGeometry(this.width + 0.5, this.height + 0.5, 2)
        const zoneMaterial = new THREE.MeshBasicMaterial({ 
            transparent: true, 
            opacity: 0,
            wireframe: false
        })
        
        this.collisionMesh = new THREE.Mesh(zoneGeometry, zoneMaterial)
        this.collisionMesh.position.z = -1
        this.collisionMesh.userData.isDoor = true
        this.collisionMesh.userData.targetRoom = this.targetRoom
        
        this.container.add(this.collisionMesh)
    }

    setInteraction()
    {
        this.isTriggered = false
    }

    checkCarCollision(_carPosition)
    {
        // Get door world position
        const doorWorldPos = new THREE.Vector3()
        this.frameMesh.getWorldPosition(doorWorldPos)

        // Get relative car position
        const carRelativePos = _carPosition.clone().sub(doorWorldPos)

        // Check if car is within door bounds
        const withinX = Math.abs(carRelativePos.x) < this.width * 0.6
        const withinY = Math.abs(carRelativePos.y) < this.height * 0.6
        const withinZ = Math.abs(carRelativePos.z) < 2

        return withinX && withinY && withinZ
    }

    triggerTransition()
    {
        if(!this.isTriggered && this.targetRoom && this.camera)
        {
            this.isTriggered = true
            this.camera.transitionToRoom(this.targetRoom)
            this.trigger('transition', { targetRoom: this.targetRoom })
        }
    }

    resetTrigger()
    {
        this.isTriggered = false
    }
}
